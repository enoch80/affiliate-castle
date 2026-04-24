/**
 * Rank Tracker — Bing SERP position monitoring for published platform URLs
 *
 * For a given campaign, fetches all published platform URLs (dev.to, Hashnode,
 * Blogger, Tumblr, bridge page) and checks their position in Bing's top 50 results
 * for the campaign's primary keyword. Stores each check as a RankSnapshot.
 *
 * Uses a lightweight SERP fetch (URLs + positions only — no page content fetch)
 * so it runs fast without hammering third-party sites.
 *
 * Environment variables:
 *   (none required — uses chromium from Playwright, same as serp-scraper)
 */

import { chromium } from 'playwright'
import * as cheerio from 'cheerio'
import { prisma } from './prisma'

export interface RankCheckResult {
  platform: string
  platformUrl: string
  keyword: string
  engine: 'bing'
  rank: number | null
  inTop10: boolean
  inTop50: boolean
  checkedAt: string
}

export interface CampaignRankReport {
  campaignId: string
  keyword: string
  checkedAt: string
  results: RankCheckResult[]
  /** How many platforms are in top 10 */
  top10Count: number
  /** How many platforms are in top 50 */
  top50Count: number
  /** Best rank found across all platforms (lowest number = best) */
  bestRank: number | null
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
]

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

/**
 * Fetch up to 50 Bing SERP result URLs for a keyword.
 * Returns array of { rank, url } — no page content fetched.
 */
async function getBingRankedUrls(keyword: string): Promise<{ rank: number; url: string }[]> {
  const ua = randomUA()
  const query = encodeURIComponent(keyword)
  // count=50 asks Bing for up to 50 results on page 1
  const bingUrl = `https://www.bing.com/search?q=${query}&count=50&form=QBLH`

  let ranked: { rank: number; url: string }[] = []

  let browser
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
    const page = await browser.newPage()
    await page.setExtraHTTPHeaders({ 'User-Agent': ua })
    await page.goto(bingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForSelector('#b_results', { timeout: 15000 }).catch(() => {})

    ranked = await page.$$eval('#b_results .b_algo', (els) =>
      els.map((el, i) => {
        const anchor = el.querySelector('h2 a') as HTMLAnchorElement | null
        return {
          rank: i + 1,
          url: anchor?.href || '',
        }
      }).filter((r) => r.url.startsWith('http'))
    )
  } catch (err) {
    console.warn('[rank-tracker] Playwright scrape failed, trying fetch fallback:', (err as Error).message)
  } finally {
    await browser?.close()
  }

  // Fetch fallback
  if (ranked.length === 0) {
    try {
      const ctrl = new AbortController()
      const timeout = setTimeout(() => ctrl.abort(), 20000)
      const res = await fetch(bingUrl, {
        headers: { 'User-Agent': ua, Accept: 'text/html' },
        signal: ctrl.signal,
      })
      clearTimeout(timeout)
      const html = await res.text()
      const $ = cheerio.load(html)
      let pos = 1
      $('#b_results .b_algo').each((_, el) => {
        const anchor = $(el).find('h2 a')
        const url = anchor.attr('href') || ''
        if (url.startsWith('http')) {
          ranked.push({ rank: pos++, url })
        }
      })
    } catch (err) {
      console.error('[rank-tracker] Fetch fallback also failed:', (err as Error).message)
    }
  }

  return ranked
}

/**
 * Normalise a URL for comparison — strips protocol, trailing slash, www prefix.
 */
function normaliseUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .toLowerCase()
}

/**
 * Check if `targetUrl` appears in the ranked list, using normalised comparison.
 * Returns the rank (1-based) or null.
 */
function findRank(
  targetUrl: string,
  ranked: { rank: number; url: string }[]
): number | null {
  const normalTarget = normaliseUrl(targetUrl)
  for (const { rank, url } of ranked) {
    if (normaliseUrl(url).includes(normalTarget) || normalTarget.includes(normaliseUrl(url))) {
      return rank
    }
  }
  return null
}

/**
 * Run a rank check for a campaign.
 *
 * 1. Loads the campaign's keyword (from KeywordResearch) and all published URLs
 *    (PublishJob.platformUrl where status=published + BridgePage.slug).
 * 2. Fetches Bing top 50 for the keyword.
 * 3. Checks each published URL.
 * 4. Stores RankSnapshot rows.
 * 5. Returns a CampaignRankReport.
 */
export async function checkCampaignRankings(campaignId: string): Promise<CampaignRankReport> {
  // Load campaign with related data
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      publishJobs: {
        where: { status: 'published', platformUrl: { not: null } },
        select: { platform: true, platformUrl: true },
      },
      bridgePages: {
        where: { publishedAt: { not: null } },
        select: { slug: true },
        take: 1,
      },
      offer: {
        include: {
          keywordResearch: {
            select: { primaryKeyword: true },
            take: 1,
          },
        },
      },
    },
  })

  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`)

  const keyword = campaign.offer?.keywordResearch?.[0]?.primaryKeyword ?? campaign.name
  const checkedAt = new Date()

  // Collect all URLs to check
  const urlsToCheck: { platform: string; url: string }[] = []

  for (const job of campaign.publishJobs) {
    if (job.platformUrl) {
      urlsToCheck.push({ platform: job.platform, url: job.platformUrl })
    }
  }

  // Bridge page (construct from APP_BASE_URL + slug)
  if (campaign.bridgePages.length > 0) {
    const baseUrl = (process.env.APP_BASE_URL || 'https://t.yourdomain.com').replace(/\/$/, '')
    urlsToCheck.push({
      platform: 'bridge',
      url: `${baseUrl}/go/${campaign.bridgePages[0].slug}`,
    })
  }

  if (urlsToCheck.length === 0) {
    console.warn(`[rank-tracker] Campaign ${campaignId} has no published URLs to check`)
    return {
      campaignId,
      keyword,
      checkedAt: checkedAt.toISOString(),
      results: [],
      top10Count: 0,
      top50Count: 0,
      bestRank: null,
    }
  }

  console.log(`[rank-tracker] Checking ${urlsToCheck.length} URLs for keyword: "${keyword}"`)

  // Fetch Bing rankings once
  const ranked = await getBingRankedUrls(keyword)
  console.log(`[rank-tracker] Got ${ranked.length} Bing SERP results`)

  const results: RankCheckResult[] = []

  for (const { platform, url } of urlsToCheck) {
    const rank = findRank(url, ranked)
    const inTop10 = rank !== null && rank <= 10
    const inTop50 = rank !== null && rank <= 50

    results.push({
      platform,
      platformUrl: url,
      keyword,
      engine: 'bing',
      rank,
      inTop10,
      inTop50,
      checkedAt: checkedAt.toISOString(),
    })

    // Persist snapshot
    await prisma.rankSnapshot.create({
      data: {
        campaignId,
        platform,
        platformUrl: url,
        keyword,
        engine: 'bing',
        rank,
        inTop10,
        inTop50,
        checkedAt,
      },
    })

    console.log(`[rank-tracker] ${platform} → ${url} → rank: ${rank ?? 'not found'}`)
  }

  const rankedResults = results.filter((r) => r.rank !== null)
  const bestRank =
    rankedResults.length > 0
      ? Math.min(...rankedResults.map((r) => r.rank as number))
      : null

  return {
    campaignId,
    keyword,
    checkedAt: checkedAt.toISOString(),
    results,
    top10Count: results.filter((r) => r.inTop10).length,
    top50Count: results.filter((r) => r.inTop50).length,
    bestRank,
  }
}

/**
 * Load the most recent rank snapshot per platform for a campaign.
 * Also returns the last 30 days of history per platform for trend display.
 */
export async function getCampaignRankHistory(campaignId: string): Promise<{
  latest: RankCheckResult[]
  history: { platform: string; snapshots: Array<{ rank: number | null; checkedAt: string }> }[]
}> {
  const since = new Date()
  since.setDate(since.getDate() - 30)

  const allSnapshots = await prisma.rankSnapshot.findMany({
    where: { campaignId, checkedAt: { gte: since } },
    orderBy: { checkedAt: 'desc' },
  })

  // Group by platform
  // Array.from avoids --downlevelIteration requirement
  const platforms = Array.from(new Set(allSnapshots.map((s: { platform: string }) => s.platform)))

  const latest: RankCheckResult[] = []
  const history: { platform: string; snapshots: Array<{ rank: number | null; checkedAt: string }> }[] = []

  for (const platform of platforms) {
    const platformSnaps = allSnapshots.filter(
      (s: { platform: string }) => s.platform === platform
    ) as typeof allSnapshots
    const newest = platformSnaps[0]

    latest.push({
      platform: newest.platform,
      platformUrl: newest.platformUrl,
      keyword: newest.keyword,
      engine: 'bing',
      rank: newest.rank,
      inTop10: newest.inTop10,
      inTop50: newest.inTop50,
      checkedAt: newest.checkedAt.toISOString(),
    })

    history.push({
      platform,
      snapshots: platformSnaps.map((s: typeof newest) => ({
        rank: s.rank,
        checkedAt: s.checkedAt.toISOString(),
      })),
    })
  }

  return { latest, history }
}
