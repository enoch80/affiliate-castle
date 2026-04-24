import { test } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3200'

test('visual: login page', async ({ page }) => {
  await page.goto(`${BASE}/login`)
  await page.screenshot({ path: 'test-results/s3_00_login.png', fullPage: false })
})

test('visual: dashboard after login', async ({ page }) => {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', 'admin@affiliatecastle.local')
  await page.fill('input[type="password"]', 'AffCastle2026')
  await page.click('button[type="submit"]')
  await page.waitForURL(/dashboard/, { timeout: 15000 })
  await page.screenshot({ path: 'test-results/s3_01_dashboard.png', fullPage: false })
})

test('visual: campaigns list', async ({ page }) => {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', 'admin@affiliatecastle.local')
  await page.fill('input[type="password"]', 'AffCastle2026')
  await page.click('button[type="submit"]')
  await page.waitForURL(/dashboard/, { timeout: 15000 })
  await page.goto(`${BASE}/dashboard/campaigns`)
  await page.waitForLoadState('domcontentloaded')
  await page.screenshot({ path: 'test-results/s3_02_campaigns.png', fullPage: true })
})

test('visual: campaign detail with pipeline', async ({ page }) => {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', 'admin@affiliatecastle.local')
  await page.fill('input[type="password"]', 'AffCastle2026')
  await page.click('button[type="submit"]')
  await page.waitForURL(/dashboard/, { timeout: 15000 })
  
  const res = await page.request.post(`${BASE}/api/offers`, {
    data: { hoplink: 'https://hop.clickbank.net/?affiliate=qa&vendor=sprint3visual' },
    headers: { 'Content-Type': 'application/json' },
  })
  const body = await res.json()
  if (body.campaignId) {
    await page.goto(`${BASE}/dashboard/campaigns/${body.campaignId}`)
    await page.waitForLoadState('domcontentloaded')
    await page.screenshot({ path: 'test-results/s3_03_campaign_pipeline.png', fullPage: true })
  }
})

test('visual: brief_ready content brief panel', async ({ page }) => {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', 'admin@affiliatecastle.local')
  await page.fill('input[type="password"]', 'AffCastle2026')
  await page.click('button[type="submit"]')
  await page.waitForURL(/dashboard/, { timeout: 15000 })

  // Navigate to an already-processed brief_ready campaign
  await page.goto(`${BASE}/dashboard/campaigns/cmoc8tjk6000eib2yljk6tkab`)
  await page.waitForLoadState('domcontentloaded')
  await page.screenshot({ path: 'test-results/s4_00_content_brief.png', fullPage: true })
})
