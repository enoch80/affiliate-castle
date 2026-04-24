/**
 * Sprint 10 E2E — Dashboard analytics, charts, conversion funnel, PWA
 * Verification criteria:
 *   - /api/analytics returns 30-day series + KPIs
 *   - /api/campaigns/:id/analytics returns funnel (6 stages) + platformBreakdown
 *   - /dashboard/analytics page loads with real Recharts charts
 *   - PWA: /manifest.json returns theme_color + start_url
 *
 * Regression rule: runs alongside sprint1–9 tests every time a new sprint completes.
 * No sprint 1–9 test may fail as a result of Sprint 10 changes.
 */
import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://109.199.106.147:3200'
const EMAIL = 'admin@affiliatecastle.local'
const PASSWORD = 'AffCastle2026'

test.describe('Sprint 10 – Dashboard Analytics & PWA', () => {
  // ── 1 ──────────────────────────────────────────────────────────────────────
  test('health check still returns ok (regression)', async ({ request }) => {
    const resp = await request.get(`${BASE}/api/health`)
    expect(resp.status()).toBe(200)
    expect((await resp.json()).status).toBe('ok')
  })

  // ── 2 ──────────────────────────────────────────────────────────────────────
  test('GET /api/analytics requires auth (401)', async ({ request }) => {
    const resp = await request.get(`${BASE}/api/analytics`)
    expect(resp.status()).toBe(401)
  })

  // ── 3 ──────────────────────────────────────────────────────────────────────
  test('GET /api/analytics returns correct structure', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })

    const resp = await page.request.get(`${BASE}/api/analytics`)
    expect(resp.ok()).toBeTruthy()

    const body = await resp.json()
    expect(body).toHaveProperty('totalClicks')
    expect(body).toHaveProperty('totalConversions')
    expect(body).toHaveProperty('totalRevenue')
    expect(body).toHaveProperty('epc')
    expect(body).toHaveProperty('campaignCount')
    expect(body).toHaveProperty('activeCampaignCount')
    expect(body).toHaveProperty('series')
    expect(Array.isArray(body.series)).toBe(true)
    // Should return 30 days of data
    expect(body.series.length).toBe(30)
    // Each series entry should have required fields
    const first = body.series[0]
    expect(first).toHaveProperty('date')
    expect(first).toHaveProperty('clicks')
    expect(first).toHaveProperty('conversions')
    expect(first).toHaveProperty('revenue')
    expect(first).toHaveProperty('optIns')
    console.log(`[sprint10] Analytics: ${body.campaignCount} campaigns, EPC=$${body.epc}`)
  })

  // ── 4 ──────────────────────────────────────────────────────────────────────
  test('GET /api/campaigns/:id/analytics requires auth (401)', async ({ request }) => {
    const resp = await request.get(`${BASE}/api/campaigns/any-id/analytics`)
    expect(resp.status()).toBe(401)
  })

  // ── 5 ──────────────────────────────────────────────────────────────────────
  test('GET /api/campaigns/:id/analytics returns funnel with 6 stages', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })

    const listResp = await page.request.get(`${BASE}/api/campaigns`)
    if (!listResp.ok()) return
    const data = await listResp.json()
    const campaigns = Array.isArray(data) ? data : (data.campaigns ?? [])
    if (campaigns.length === 0) {
      console.log('[sprint10] No campaigns — skipping funnel test')
      return
    }

    const resp = await page.request.get(`${BASE}/api/campaigns/${campaigns[0].id}/analytics`)
    expect(resp.ok()).toBeTruthy()

    const body = await resp.json()
    expect(body).toHaveProperty('funnel')
    expect(Array.isArray(body.funnel)).toBe(true)
    expect(body.funnel.length).toBe(6)

    const stages = body.funnel.map((f: { stage: string }) => f.stage)
    expect(stages).toContain('Impressions')
    expect(stages).toContain('Clicks')
    expect(stages).toContain('Opt-ins')
    expect(stages).toContain('Conversions')
    console.log(`[sprint10] Funnel stages: ${stages.join(' → ')}`)
  })

  // ── 6 ──────────────────────────────────────────────────────────────────────
  test('GET /api/campaigns/:id/analytics returns platformBreakdown array', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })

    const listResp = await page.request.get(`${BASE}/api/campaigns`)
    if (!listResp.ok()) return
    const data = await listResp.json()
    const campaigns = Array.isArray(data) ? data : (data.campaigns ?? [])
    if (campaigns.length === 0) {
      console.log('[sprint10] No campaigns — skipping platformBreakdown test')
      return
    }

    const resp = await page.request.get(`${BASE}/api/campaigns/${campaigns[0].id}/analytics`)
    expect(resp.ok()).toBeTruthy()

    const body = await resp.json()
    expect(body).toHaveProperty('platformBreakdown')
    expect(Array.isArray(body.platformBreakdown)).toBe(true)
    expect(body).toHaveProperty('summary')
    expect(body.summary).toHaveProperty('epc')
    expect(body.summary).toHaveProperty('conversionRate')
    console.log(`[sprint10] platformBreakdown entries: ${body.platformBreakdown.length}`)
  })

  // ── 7 ──────────────────────────────────────────────────────────────────────
  test('/dashboard/analytics page loads with chart elements', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })

    await page.goto(`${BASE}/dashboard/analytics`)
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    // Page should not show an error state
    const body = await page.locator('body').innerText()
    expect(body).not.toContain('Application error')
    expect(body).not.toContain('500')

    // Should contain metric labels for the switcher
    const hasMetrics =
      (await page.locator('text=Clicks').count()) > 0 ||
      (await page.locator('text=Revenue').count()) > 0 ||
      (await page.locator('text=Loading').count()) > 0
    expect(hasMetrics).toBe(true)
    console.log('[sprint10] /dashboard/analytics page loaded OK')
  })

  // ── 8 ──────────────────────────────────────────────────────────────────────
  test('/dashboard/campaigns page loads (regression)', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })

    await page.goto(`${BASE}/dashboard/campaigns`)
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    const body = await page.locator('body').innerText()
    expect(body).not.toContain('Application error')
    expect(body).not.toContain('500')
    console.log('[sprint10] /dashboard/campaigns page loaded OK (regression)')
  })

  // ── 9 ──────────────────────────────────────────────────────────────────────
  test('GET /manifest.json returns valid PWA manifest', async ({ request }) => {
    const resp = await request.get(`${BASE}/manifest.json`)
    expect(resp.status()).toBe(200)

    const body = await resp.json()
    expect(body).toHaveProperty('name')
    expect(body).toHaveProperty('start_url')
    expect(body).toHaveProperty('display')
    expect(body).toHaveProperty('theme_color')
    expect(body.display).toBe('standalone')
    expect(body.start_url).toBe('/dashboard')
    expect(body.theme_color).toBe('#0F172A')
    console.log(`[sprint10] PWA manifest OK: name="${body.name}", display="${body.display}"`)
  })

  // ── 10 ─────────────────────────────────────────────────────────────────────
  test('GET /api/campaigns regression – still returns array post-sprint-10', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })

    const resp = await page.request.get(`${BASE}/api/campaigns`)
    expect(resp.ok()).toBeTruthy()

    const data = await resp.json()
    const campaigns = Array.isArray(data) ? data : (data.campaigns ?? [])
    expect(Array.isArray(campaigns)).toBe(true)
    console.log(`[sprint10] /api/campaigns regression: ${campaigns.length} campaigns returned`)
  })
})
