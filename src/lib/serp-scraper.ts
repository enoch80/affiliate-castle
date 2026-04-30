/**
 * SERP Scraper — Sprint 3
 * Scrapes Bing top 10 organic results for a keyword using Playwright.
 * For each result, fetches the page and extracts structure for semantic gap analysis.
 */

import { chromium } from 'playwright'
import * as cheerio from 'cheerio'

export interface SerpResult {
  rank: number
  url: string
  title: string
  snippet: string
  /** Raw text content of the page (fetched separately) */
  bodyText: string
  wordCount: number
  h1: string[]
  h2: string[]
  h3: string[]
  /** FAQ pairs found on the page */
  faqPairs: { question: string; answer: string }[]
  namedEntities: string[]
}

/** SERP-level data extracted from the search results page itself */
export interface SerpPageData {
  /** People Also Ask questions extracted from the SERP */
  paaQuestions: string[]
  /** Related searches extracted from the bottom of the SERP */
  relatedSearches: string[]
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
]

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

/** Extract structured data from a page's HTML */
function parsePageHtml(html: string): Omit<SerpResult, 'rank' | 'url' | 'title' | 'snippet' | 'namedEntities'> {
  const $ = cheerio.load(html)

  // Remove nav, footer, aside, script, style noise
  $('nav, footer, aside, script, style, noscript, [class*="cookie"], [class*="popup"], [id*="modal"]').remove()

  const h1 = $('h1').map((_, el) => $(el).text().trim()).get().filter(Boolean)
  const h2 = $('h2').map((_, el) => $(el).text().trim()).get().filter(Boolean)
  const h3 = $('h3').map((_, el) => $(el).text().trim()).get().filter(Boolean)

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim()
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length

  // Extract FAQ pairs from common FAQ patterns
  const faqPairs: { question: string; answer: string }[] = []

  // Pattern 1: dt/dd pairs
  $('dt').each((_, el) => {
    const q = $(el).text().trim()
    const a = $(el).next('dd').text().trim()
    if (q && a) faqPairs.push({ question: q, answer: a })
  })

  // Pattern 2: div/section with question-like h3 followed by p
  $('h3, h4').each((_, el) => {
    const text = $(el).text().trim()
    if (text.endsWith('?') || text.toLowerCase().startsWith('what') ||
        text.toLowerCase().startsWith('how') || text.toLowerCase().startsWith('why') ||
        text.toLowerCase().startsWith('is ') || text.toLowerCase().startsWith('can ')) {
      const answer = $(el).next('p').text().trim()
      if (answer) faqPairs.push({ question: text, answer: answer.slice(0, 300) })
    }
  })

  return { bodyText: bodyText.slice(0, 50000), wordCount, h1, h2, h3, faqPairs: faqPairs.slice(0, 20) }
}

/** Fetch a single page HTML via fetch with a timeout */
async function fetchPage(url: string, ua: string): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: ctrl.signal,
    })
    if (!res.ok) return ''
    return await res.text()
  } catch {
    return ''
  } finally {
    clearTimeout(timer)
  }
}

/** Scrape Bing top 10 organic results for a keyword */
export async function scrapeSerpTop10(
  keyword: string,
): Promise<{ results: SerpResult[]; serpPageData: SerpPageData }> {
  console.log(`[serp-scraper] Scraping Bing top 10 for: "${keyword}"`)

  const ua = randomUA()
  const query = encodeURIComponent(keyword)
  const bingUrl = `https://www.bing.com/search?q=${query}&count=10&form=QBLH`

  let browser
  let serpLinks: { url: string; title: string; snippet: string }[] = []
  let paaQuestions: string[] = []
  let relatedSearches: string[] = []

  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
    const page = await browser.newPage()
    await page.setExtraHTTPHeaders({ 'User-Agent': ua })

    await page.goto(bingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

    // Wait for results
    await page.waitForSelector('#b_results', { timeout: 15000 }).catch(() => {})

    serpLinks = await page.$$eval('#b_results .b_algo', (els) =>
      els.slice(0, 10).map((el) => {
        const anchor = el.querySelector('h2 a') as HTMLAnchorElement | null
        const snippet = el.querySelector('.b_caption p') as HTMLElement | null
        return {
          url: anchor?.href || '',
          title: anchor?.textContent?.trim() || '',
          snippet: snippet?.textContent?.trim() || '',
        }
      }).filter((r) => r.url && r.url.startsWith('http'))
    )

    // Extract People Also Ask questions
    paaQuestions = await page.$$eval(
      '.b_alsoask button, [data-tag="AlsoAsk"] .b_rcTxt',
      (els) => els.map((el) => el.textContent?.trim() ?? '').filter(Boolean).slice(0, 8),
    ).catch(() => [] as string[])

    // Extract Related Searches from bottom of SERP
    relatedSearches = await page.$$eval(
      '#b_context .b_vList li a',
      (els) => els.map((el) => el.textContent?.trim() ?? '').filter(Boolean).slice(0, 8),
    ).catch(() => [] as string[])

    console.log(`[serp-scraper] Found ${serpLinks.length} SERP results from Bing, ${paaQuestions.length} PAA, ${relatedSearches.length} related searches`)
  } catch (err) {
    console.error('[serp-scraper] Bing scrape error:', err)
  } finally {
    await browser?.close()
  }

  // Fallback: if Playwright failed, use fetch-based approach
  if (serpLinks.length === 0) {
    console.warn('[serp-scraper] Playwright failed, using fetch fallback')
    try {
      const html = await fetchPage(bingUrl, ua)
      const $ = cheerio.load(html)
      $('#b_results .b_algo').slice(0, 10).each((_, el) => {
        const anchor = $(el).find('h2 a')
        const snippet = $(el).find('.b_caption p')
        const url = anchor.attr('href') || ''
        if (url.startsWith('http')) {
          serpLinks.push({
            url,
            title: anchor.text().trim(),
            snippet: snippet.text().trim(),
          })
        }
      })
    } catch (err) {
      console.error('[serp-scraper] Fetch fallback also failed:', err)
    }
  }

  if (serpLinks.length === 0) {
    console.warn('[serp-scraper] No SERP results found — returning empty array')
    return { results: [], serpPageData: { paaQuestions, relatedSearches } }
  }

  // Now fetch and parse each result page
  const results: SerpResult[] = []
  let rank = 1

  for (const link of serpLinks.slice(0, 10)) {
    try {
      const pageHtml = await fetchPage(link.url, randomUA())
      if (!pageHtml) {
        results.push({ rank, ...link, bodyText: '', wordCount: 0, h1: [], h2: [], h3: [], faqPairs: [], namedEntities: [] })
      } else {
        const parsed = parsePageHtml(pageHtml)
        results.push({ rank, ...link, ...parsed, namedEntities: [] })
      }
    } catch {
      results.push({ rank, ...link, bodyText: '', wordCount: 0, h1: [], h2: [], h3: [], faqPairs: [], namedEntities: [] })
    }
    rank++
    // Polite delay between page fetches
    await new Promise((r) => setTimeout(r, 500))
  }

  console.log(`[serp-scraper] Parsed ${results.length} SERP pages`)
  return { results, serpPageData: { paaQuestions, relatedSearches } }
}
