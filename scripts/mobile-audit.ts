/**
 * Mobile UI Audit Script
 * Captures screenshots at iPhone 14 Pro viewport (390x844) for all major views
 */
import { chromium } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3200'
const EMAIL = 'admin@affiliatecastle.local'
const PASSWORD = 'AffCastle2026'
const OUT_DIR = path.join(process.cwd(), 'test-results', 'mobile-audit')

// iPhone 14 Pro viewport
const MOBILE = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: MOBILE.width, height: MOBILE.height },
    isMobile: MOBILE.isMobile,
    hasTouch: MOBILE.hasTouch,
    deviceScaleFactor: MOBILE.deviceScaleFactor,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  const page = await ctx.newPage()

  const ss = async (name: string, fullPage = true) => {
    const p = path.join(OUT_DIR, `${name}.png`)
    await page.screenshot({ path: p, fullPage })
    console.log(`✓ ${name}.png`)
    return p
  }

  // 1. Login page
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await ss('01_login')

  // 2. Log in
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/dashboard/, { timeout: 15000 })

  // 3. Dashboard home
  await page.waitForLoadState('networkidle')
  await ss('02_dashboard_home')
  // Also capture above-fold
  await page.screenshot({ path: path.join(OUT_DIR, '02_dashboard_home_fold.png'), fullPage: false })
  console.log('✓ 02_dashboard_home_fold.png')

  // 4. Campaigns list
  await page.goto(`${BASE}/dashboard/campaigns`, { waitUntil: 'networkidle' })
  await ss('03_campaigns_list')

  // 5. Campaign detail (first campaign)
  try {
    const resp = await page.request.get(`${BASE}/api/campaigns`)
    const campaigns = await resp.json() as { id: string }[]
    if (campaigns.length > 0) {
      const id = campaigns[0].id
      await page.goto(`${BASE}/dashboard/campaigns/${id}`, { waitUntil: 'networkidle' })
      await ss('04_campaign_detail')
      await page.screenshot({ path: path.join(OUT_DIR, '04_campaign_detail_fold.png'), fullPage: false })
      console.log('✓ 04_campaign_detail_fold.png')

      // Sub-tabs
      await page.goto(`${BASE}/dashboard/campaigns/${id}/tracking`, { waitUntil: 'networkidle' })
      await ss('05_campaign_tracking')

      await page.goto(`${BASE}/dashboard/campaigns/${id}/publishing`, { waitUntil: 'networkidle' })
      await ss('06_campaign_publishing')

      await page.goto(`${BASE}/dashboard/campaigns/${id}/email`, { waitUntil: 'networkidle' })
      await ss('07_campaign_email')

      await page.goto(`${BASE}/dashboard/campaigns/${id}/telegram`, { waitUntil: 'networkidle' })
      await ss('08_campaign_telegram')

      await page.goto(`${BASE}/dashboard/campaigns/${id}/rankings`, { waitUntil: 'networkidle' })
      await ss('09_campaign_rankings')
    }
  } catch (e) {
    console.warn('Campaign detail screenshots failed:', e)
  }

  // 6. Analytics
  await page.goto(`${BASE}/dashboard/analytics`, { waitUntil: 'networkidle' })
  await ss('10_analytics')

  // 7. Settings
  await page.goto(`${BASE}/dashboard/settings`, { waitUntil: 'networkidle' })
  await ss('11_settings')

  await browser.close()
  console.log(`\nAll screenshots saved to: ${OUT_DIR}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
