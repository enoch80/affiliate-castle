/**
 * Offer Scraper
 * Uses Playwright to visit the final landing page and extract:
 * - Page HTML (trimmed to key sections)
 * - Page title, headline, price signals, guarantee mentions
 * Returns structured data for the LLM extractor
 */

export interface ScrapedPage {
  url: string
  title: string
  metaDescription?: string
  h1?: string
  headlines: string[]
  bodyText: string
  priceText?: string
  guaranteeText?: string
  html: string
}

const PRICE_PATTERN = /\$[\d,]+(?:\.\d{2})?(?:\s*\/\s*(?:month|year|mo|yr))?|\d+(?:\.\d{2})?\s*USD/gi
const GUARANTEE_PATTERN = /(\d+[\s-]day|money[\s-]back|guarantee|refund|risk[\s-]free)/gi

/**
 * Scrape the offer landing page using Playwright
 * Graceful degradation: if Playwright fails, falls back to a lightweight http fetch
 */
export async function scrapeOfferPage(url: string): Promise<ScrapedPage> {
  try {
    return await scrapeWithPlaywright(url)
  } catch (err) {
    console.warn('[scraper] Playwright failed, falling back to fetch:', err)
    return await scrapeWithFetch(url)
  }
}

async function scrapeWithPlaywright(url: string): Promise<ScrapedPage> {
  // Dynamic import so the module loads even if playwright isn't installed in dev
  const { chromium } = await import('playwright')

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })

    // Wait for main content to appear  
    await page.waitForTimeout(1500)

    const data = await page.evaluate(() => {
      // Helper to clean text
      const clean = (t: string) => t.replace(/\s+/g, ' ').trim()

      const title = document.title
      const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
      const h1 = document.querySelector('h1')?.textContent || ''
      const headlines = Array.from(document.querySelectorAll('h1,h2,h3'))
        .map(el => clean(el.textContent || ''))
        .filter(t => t.length > 5)
        .slice(0, 15)

      // Get visible body text, skip nav/footer/script
      const skipTags = new Set(['SCRIPT', 'STYLE', 'NAV', 'FOOTER', 'HEADER'])
      function getText(node: Node): string {
        if (node.nodeType === Node.TEXT_NODE) return (node.textContent || '') + ' '
        if (skipTags.has((node as Element).tagName)) return ''
        return Array.from(node.childNodes).map(getText).join('')
      }

      const bodyText = clean(getText(document.body)).slice(0, 6000)
      const html = document.body.innerHTML.slice(0, 30000)

      return { title, metaDesc, h1, headlines, bodyText, html }
    })

    const priceMatches = data.bodyText.match(PRICE_PATTERN)
    const guaranteeMatches = data.bodyText.match(GUARANTEE_PATTERN)

    return {
      url,
      title: data.title,
      metaDescription: data.metaDesc,
      h1: data.h1,
      headlines: data.headlines,
      bodyText: data.bodyText,
      priceText: priceMatches ? priceMatches.slice(0, 5).join(', ') : undefined,
      guaranteeText: guaranteeMatches ? guaranteeMatches.slice(0, 3).join(', ') : undefined,
      html: data.html,
    }
  } finally {
    await browser.close()
  }
}

async function scrapeWithFetch(url: string): Promise<ScrapedPage> {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AffiliateResearch/1.0)',
      'Accept': 'text/html',
    },
    signal: AbortSignal.timeout(15000),
  })

  const html = await resp.text()

  // Minimal extraction via regex (no DOM parser in Node worker context)
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || ''
  const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1] || ''
  const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() || ''

  // Strip tags for body text
  const bodyText = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000)

  const priceMatches = bodyText.match(PRICE_PATTERN)
  const guaranteeMatches = bodyText.match(GUARANTEE_PATTERN)

  return {
    url,
    title,
    metaDescription: metaDesc,
    h1,
    headlines: h1 ? [h1] : [],
    bodyText,
    priceText: priceMatches ? priceMatches.slice(0, 5).join(', ') : undefined,
    guaranteeText: guaranteeMatches ? guaranteeMatches.slice(0, 3).join(', ') : undefined,
    html: html.slice(0, 30000),
  }
}
