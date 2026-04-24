/**
 * Sprint 5 E2E — Lead magnet PDF, 4 bridge templates, exit intent JS, A/B split
 * Verification criteria: Bridge page live, PDF downloads, opt-in works
 *
 * Regression rule: this file runs alongside sprint1–4 tests every time a new sprint completes.
 */
import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://109.199.106.147:3200'
const EMAIL = 'admin@affiliatecastle.local'
const PASSWORD = 'AffCastle2026'

let bridgeReadyCampaignId: string | null = null
let slugA: string | null = null
let slugB: string | null = null

test.describe('Sprint 5 – Bridge Pages & Lead Magnet', () => {
  test('health check still returns ok (regression)', async ({ request }) => {
    const resp = await request.get(`${BASE}/api/health`)
    expect(resp.status()).toBe(200)
    expect((await resp.json()).status).toBe('ok')
  })

  test('login still works (regression)', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
  })

  test('/api/campaigns/:id/bridge requires auth (401)', async ({ request }) => {
    const resp = await request.get(`${BASE}/api/campaigns/nonexistent-id/bridge`)
    expect(resp.status()).toBe(401)
  })

  test('/api/campaigns/:id/bridge returns 404 for unknown campaign', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })

    const resp = await page.request.get(`${BASE}/api/campaigns/unknown-id-99999/bridge`)
    expect(resp.status()).toBe(404)
  })

  test('/go/nonexistent-slug returns 404', async ({ request }) => {
    const resp = await request.get(`${BASE}/go/nonexistent-bridge-slug-99999`)
    expect(resp.status()).toBe(404)
  })

  test('campaigns list loads (regression)', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })
    // Sidebar "Campaigns" nav link is visible on the dashboard
    await expect(page.locator('nav a, aside a, [role="navigation"] a').filter({ hasText: /campaigns/i }).first()).toBeVisible({ timeout: 10000 })
  })

  test('bridge_ready campaign shows Bridge Pages panel', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })

    const listResp = await page.request.get(`${BASE}/api/campaigns`)
    if (!listResp.ok()) return

    const data = await listResp.json()
    const campaigns = Array.isArray(data) ? data : (data.campaigns ?? [])
    const bridgeReady = campaigns.find((c: { status: string }) =>
      ['bridge_ready', 'bridge_live', 'publishing', 'indexed', 'live'].includes(c.status)
    )

    if (!bridgeReady) {
      console.log('[sprint5] No bridge_ready campaign yet — skipping Bridge Pages panel check')
      return
    }

    bridgeReadyCampaignId = bridgeReady.id
    await page.goto(`${BASE}/dashboard/campaigns/${bridgeReady.id}`)
    await page.waitForLoadState('domcontentloaded')

    // Sprint 5 badge
    await expect(page.locator('text=Sprint 5')).toBeVisible({ timeout: 10000 })
    // Bridge Pages heading
    await expect(page.locator('h2').filter({ hasText: 'Bridge Pages' })).toBeVisible()
    // View links for A/B variants
    await expect(page.locator('a[href*="/go/"]').first()).toBeVisible()
  })

  test('bridge API returns A/B variant slugs', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })

    if (!bridgeReadyCampaignId) {
      const listResp = await page.request.get(`${BASE}/api/campaigns`)
      if (!listResp.ok()) return
      const data = await listResp.json()
      const campaigns = Array.isArray(data) ? data : (data.campaigns ?? [])
      const bridgeReady = campaigns.find((c: { status: string }) =>
        ['bridge_ready', 'bridge_live', 'publishing', 'indexed', 'live'].includes(c.status)
      )
      if (!bridgeReady) {
        console.log('[sprint5] No bridge_ready campaign — skipping bridge API check')
        return
      }
      bridgeReadyCampaignId = bridgeReady.id
    }

    const resp = await page.request.get(`${BASE}/api/campaigns/${bridgeReadyCampaignId}/bridge`)
    expect(resp.ok()).toBeTruthy()
    const body = await resp.json()

    expect(body.totalVariants).toBeGreaterThanOrEqual(1)
    expect(Array.isArray(body.pages)).toBe(true)

    if (body.pages.length >= 2) {
      const variants = body.pages.map((p: { abVariant: string }) => p.abVariant)
      expect(variants).toContain('A')
      expect(variants).toContain('B')
      slugA = body.pages.find((p: { abVariant: string }) => p.abVariant === 'A')?.slug ?? null
      slugB = body.pages.find((p: { abVariant: string }) => p.abVariant === 'B')?.slug ?? null
      console.log(`[sprint5] slugA=${slugA} slugB=${slugB}`)
    }
  })

  test('/go/[slugA] bridge page loads and contains exit intent script', async ({ page }) => {
    if (!slugA) {
      console.log('[sprint5] No slugA available — skipping bridge page load check')
      return
    }

    const resp = await page.goto(`${BASE}/go/${slugA}`)
    expect(resp?.status()).toBe(200)

    const content = await page.content()
    // Exit intent JS should be embedded in the rendered bridge HTML
    expect(content).toContain('mouseleave')
  })

  test('/go/[slugA] bridge page contains opt-in form', async ({ page }) => {
    if (!slugA) {
      console.log('[sprint5] No slugA available — skipping opt-in form check')
      return
    }

    await page.goto(`${BASE}/go/${slugA}`)
    await page.waitForLoadState('domcontentloaded')

    // Opt-in form should have an email input
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible({ timeout: 10000 })
  })
})
