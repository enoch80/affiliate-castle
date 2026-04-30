/**
 * Keyword Golden Ratio (KGR) calculator for low-competition keyword selection.
 *
 * KGR = allintitle(keyword) / monthly_search_volume
 *
 * Platform context: this system publishes to DA 79–96 authority platforms
 * (Dev.to, Hashnode, Blogger, Tumblr). These platforms carry a keyword halo
 * multiplier of 8–15× — an article ranking for a 200/mo primary keyword will
 * surface in 1,600–3,000/mo of total semantic variant searches. This makes
 * the original KGR volume floor of ≤250 irrelevant; competition ratio is what
 * matters. KGR < 2.0 is viable on DA 90+ platforms.
 *
 * LLM note: this module makes ZERO LLM calls. All data is from:
 *   allintitle count  → Bing scrape via Playwright (same infra as serp-scraper.ts)
 *   search volume     → Bing Webmaster Tools API → DataForSEO sandbox → heuristic
 * The LLM (Mistral Small via OpenRouter) runs in offer-pipeline.ts Step 3 to
 * produce the initial seed keyword that feeds into expandKeywords().
 */

import { chromium } from 'playwright'

export interface KgrResult {
  keyword: string
  allintitleCount: number
  estimatedVolume: number
  /** estimatedVolume × KEYWORD_HALO_MULTIPLIER */
  estimatedHaloVolume: number
  kgr: number
  tier: 'golden' | 'silver' | 'bronze' | 'skip'
}

/**
 * Conservative halo multiplier for DA 79–96 authority platforms.
 * Real range is 8–15×. Using 8× (conservative) for scoring.
 */
const KEYWORD_HALO_MULTIPLIER = 8

export type PlatformTier = 'authority' | 'owned'

/**
 * Fetches the Bing allintitle count for a keyword using Playwright.
 */
async function getAllintitleCount(keyword: string): Promise<number> {
  const query = `allintitle:${keyword}`
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=1&mkt=en-US`
  let browser
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    })
    const ctx = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    })
    const page = await ctx.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })

    const countText = await page.evaluate(() => {
      const el =
        document.querySelector('.sb_count') ??
        document.querySelector('#count') ??
        document.querySelector('[aria-label*="results"]')
      return el?.textContent ?? ''
    })
    const match = countText.replace(/,/g, '').match(/(\d+)/)
    return match ? parseInt(match[1], 10) : 999
  } catch {
    return 999 // pessimistic on error — treat as too competitive
  } finally {
    await browser?.close()
  }
}

/**
 * Estimates monthly search volume for a keyword.
 * Sources tried in order: Bing WMT API → DataForSEO free sandbox → heuristic.
 */
async function estimateSearchVolume(keyword: string, autocompletePosition: number): Promise<number> {
  // Attempt 1: Bing Webmaster Tools
  const bingKey = process.env.BING_WMT_API_KEY
  if (bingKey) {
    try {
      const res = await fetch('https://ssl.bing.com/webmaster/api.svc/json/GetKeywordStats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${bingKey}`,
        },
        body: JSON.stringify({ keyword, country: 'us', language: 'en' }),
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const data = (await res.json()) as { d: { AvgMonthlySearches: number } }
        const vol = data?.d?.AvgMonthlySearches ?? 0
        if (vol > 0) return vol
      }
    } catch {
      /* fall through */
    }
  }

  // Attempt 2: DataForSEO free sandbox
  const dfsLogin = process.env.DATAFORSEO_LOGIN
  const dfsPass = process.env.DATAFORSEO_PASSWORD
  if (dfsLogin && dfsPass) {
    try {
      const auth = Buffer.from(`${dfsLogin}:${dfsPass}`).toString('base64')
      const res = await fetch(
        'https://api.dataforseo.com/v3/keywords_data/bing/search_volume/live',
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            { keywords: [keyword], location_code: 2840, language_code: 'en' },
          ]),
          signal: AbortSignal.timeout(10000),
        },
      )
      if (res.ok) {
        const data = (await res.json()) as {
          tasks: [{ result: [{ items: [{ search_volume: number }] }] }]
        }
        const vol = data?.tasks?.[0]?.result?.[0]?.items?.[0]?.search_volume ?? 0
        if (vol > 0) return vol
      }
    } catch {
      /* fall through */
    }
  }

  // Heuristic fallback — word count × position inverse
  const wordCount = keyword.split(/\s+/).length
  const positionMultiplier = Math.max(1, 6 - autocompletePosition)
  const baseVolume =
    wordCount <= 3 ? 1200 : wordCount === 4 ? 300 : wordCount === 5 ? 150 : 80
  return Math.round(baseVolume * positionMultiplier * (0.8 + Math.random() * 0.4))
}

/**
 * Compute KGR classification for one keyword candidate.
 */
function classifyKgr(
  allintitleCount: number,
  volume: number,
  platformTier: PlatformTier = 'authority',
): { kgr: number; tier: 'golden' | 'silver' | 'bronze' | 'skip' } {
  if (volume === 0) return { kgr: 99, tier: 'skip' }

  if (platformTier === 'authority') {
    if (volume < 30) return { kgr: 99, tier: 'skip' }
    const kgr = allintitleCount / volume
    const tier =
      kgr < 0.25 ? 'golden' : kgr <= 0.75 ? 'silver' : kgr <= 2.0 ? 'bronze' : 'skip'
    return { kgr, tier }
  }

  // 'owned' — new domain, strict original KGR rules
  if (volume > 250) return { kgr: 99, tier: 'skip' }
  const kgr = allintitleCount / volume
  const tier = kgr < 0.25 ? 'golden' : kgr <= 1.0 ? 'silver' : 'skip'
  return { kgr, tier }
}

/**
 * Expands a seed keyword into up to 15 Bing autocomplete candidates.
 * Returns the expanded list plus detected search intent.
 */
export async function expandKeywords(
  seedKeyword: string,
  _niche: string,
): Promise<{ expanded: string[]; searchIntent: string }> {
  const prefixes = [
    seedKeyword,
    `how to ${seedKeyword}`,
    `best ${seedKeyword} for beginners`,
    `${seedKeyword} tips`,
    `${seedKeyword} guide`,
    `${seedKeyword} for seniors`,
  ]
  const expanded: string[] = []

  for (const prefix of prefixes) {
    try {
      const url = `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(prefix)}&Market=en-US`
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 5000)
      const res = await fetch(url, { signal: ctrl.signal })
      clearTimeout(t)
      if (res.ok) {
        const data = (await res.json()) as [string, string[]]
        const suggestions = (data[1] || []).filter((s) => {
          const words = s.split(' ')
          return words.length >= 3 && words.length <= 7
        })
        expanded.push(...suggestions)
      }
    } catch {
      /* non-fatal */
    }
    await new Promise((r) => setTimeout(r, 300))
  }

  const unique = Array.from(new Set(expanded.map((s) => s.toLowerCase()))).slice(0, 15)

  const seedLower = seedKeyword.toLowerCase()
  const searchIntent = /\b(how to|tutorial|guide|tips|steps|learn|beginner)\b/.test(seedLower)
    ? 'informational'
    : /\b(best|top|review|vs|compare)\b/.test(seedLower)
    ? 'commercial'
    : /\b(buy|price|discount|coupon|deal)\b/.test(seedLower)
    ? 'transactional'
    : 'informational'

  return { expanded: unique, searchIntent }
}

/**
 * Scores all candidate keywords by KGR and returns them sorted best-first.
 *
 * @param candidates - keyword strings (from Bing autocomplete or manual list)
 * @param maxConcurrency - max parallel Playwright browsers (default 2)
 * @param platformTier - 'authority' for DA 79-96 platforms, 'owned' for new blogs
 */
export async function scoreKeywordsByKgr(
  candidates: string[],
  maxConcurrency = 2,
  platformTier: PlatformTier = 'authority',
): Promise<KgrResult[]> {
  const results: KgrResult[] = []

  for (let i = 0; i < candidates.length; i += maxConcurrency) {
    const batch = candidates.slice(i, i + maxConcurrency)
    const batchResults = await Promise.all(
      batch.map(async (keyword, batchIdx) => {
        const [allintitleCount, estimatedVolume] = await Promise.all([
          getAllintitleCount(keyword),
          estimateSearchVolume(keyword, i + batchIdx + 1),
        ])
        const { kgr, tier } = classifyKgr(allintitleCount, estimatedVolume, platformTier)
        const estimatedHaloVolume =
          platformTier === 'authority'
            ? estimatedVolume * KEYWORD_HALO_MULTIPLIER
            : estimatedVolume
        return {
          keyword,
          allintitleCount,
          estimatedVolume,
          estimatedHaloVolume,
          kgr,
          tier,
        } satisfies KgrResult
      }),
    )
    results.push(...batchResults)
    if (i + maxConcurrency < candidates.length) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  const tierOrder: Record<string, number> = { golden: 0, silver: 1, bronze: 2, skip: 3 }
  return results.sort(
    (a, b) => tierOrder[a.tier] - tierOrder[b.tier] || a.kgr - b.kgr,
  )
}

/**
 * Picks the best keyword from a scored list.
 *
 * For authority platforms: Score = estimatedHaloVolume × (1 / (kgr + 0.1))
 * This rewards both large total audience reach AND low competition simultaneously.
 *
 * For owned platforms: strict lowest KGR first, primary volume ≥ 50.
 */
export function pickBestKeyword(
  scored: KgrResult[],
  platformTier: PlatformTier = 'authority',
): KgrResult {
  if (platformTier === 'authority') {
    const viable = scored.filter((r) => r.tier !== 'skip')
    if (viable.length === 0) return scored[0]
    return viable.reduce((best, r) => {
      const score = r.estimatedHaloVolume * (1 / (r.kgr + 0.1))
      const bestScore = best.estimatedHaloVolume * (1 / (best.kgr + 0.1))
      return score > bestScore ? r : best
    })
  }
  // 'owned' — strict lowest KGR first, primary volume ≥ 50 minimum
  const viable = scored.filter((r) => r.tier !== 'skip' && r.estimatedVolume >= 50)
  return viable[0] ?? scored[0]
}
