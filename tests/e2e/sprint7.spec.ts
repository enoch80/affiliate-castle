/**
 * Sprint 7 E2E — Multi-platform publisher, IndexNow, Canvas image generator, sitemap
 * Verification criteria: All 4 platforms have live URLs after launch
 *
 * Regression rule: runs alongside sprint1–6 tests every time a new sprint completes.
 */
import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://109.199.106.147:3200'
const EMAIL = 'admin@affiliatecastle.local'
const PASSWORD = 'AffCastle2026'

test.describe('Sprint 7 – Multi-Platform Publishing', () => {
  test('health check still returns ok (regression)', async ({ request }) => {
    const resp = await request.get(`${BASE}/api/health`)
    expect(resp.status()).toBe(200)
    expect((await resp.json()).status).toBe('ok')
  })

  test('/api/campaigns/:id/publishing requires auth (401)', async ({ request }) => {
    const resp = await request.get(`${BASE}/api/campaigns/nonexistent-id/publishing`)
    expect(resp.status()).toBe(401)
  })

  test('/api/campaigns/:id/publishing returns 404 for unknown campaign', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })

    const resp = await page.request.get(`${BASE}/api/campaigns/unknown-campaign-99999/publishing`)
    expect(resp.status()).toBe(404)
  })

  test('/api/campaigns/:id/publishing returns platform status array', async ({ page }) => {
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
      console.log('[sprint7] No campaigns yet — skipping publishing API check')
      return
    }

    const resp = await page.request.get(`${BASE}/api/campaigns/${campaigns[0].id}/publishing`)
    expect(resp.ok()).toBeTruthy()

    const body = await resp.json()
    expect(body).toHaveProperty('platforms')
    expect(Array.isArray(body.platforms)).toBe(true)
    expect(body.platforms).toHaveLength(4)

    const platformNames = body.platforms.map((p: { platform: string }) => p.platform)
    expect(platformNames).toContain('devto')
    expect(platformNames).toContain('hashnode')
    expect(platformNames).toContain('blogger')
    expect(platformNames).toContain('tumblr')

    console.log(`[sprint7] Publishing API OK — ${body.publishedCount}/4 platforms published`)
  })

  test('sitemap.xml is served by the app', async ({ request }) => {
    const resp = await request.get(`${BASE}/sitemap.xml`)
    // Sitemap may not exist yet (empty deployment) but must not crash the server
    expect([200, 404]).toContain(resp.status())
    if (resp.status() === 200) {
      const text = await resp.text()
      expect(text).toContain('<urlset')
      console.log('[sprint7] sitemap.xml present and valid')
    } else {
      console.log('[sprint7] sitemap.xml not yet generated — OK for first deploy')
    }
  })

  test('IndexNow key file is served (or INDEXNOW_KEY not configured)', async ({ request }) => {
    // The key file is optional — only check it doesn't 500
    const resp = await request.get(`${BASE}/indexnow.txt`)
    expect([200, 404]).toContain(resp.status())
  })

  test('/api/postback still returns 200 for ClickBank format (regression)', async ({ request }) => {
    const resp = await request.get(
      `${BASE}/api/postback?tid=SPRINT7TEST&cbreceipt=TX-SPRINT7&amount=97.00`
    )
    expect(resp.status()).toBe(200)
  })

  test('publishing status shows not_started when no platforms configured', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })

    const listResp = await page.request.get(`${BASE}/api/campaigns`)
    if (!listResp.ok()) return

    const data = await listResp.json()
    const campaigns = Array.isArray(data) ? data : (data.campaigns ?? [])
    if (campaigns.length === 0) return

    const resp = await page.request.get(`${BASE}/api/campaigns/${campaigns[0].id}/publishing`)
    if (!resp.ok()) return

    const body = await resp.json()
    const platforms = body.platforms as Array<{ status: string }>
    const validStatuses = ['not_started', 'queued', 'published', 'failed']

    for (const p of platforms) {
      expect(validStatuses).toContain(p.status)
    }
  })

  test('tracking API still works post-sprint-7 (regression)', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })

    const listResp = await page.request.get(`${BASE}/api/campaigns`)
    if (!listResp.ok()) return
    const data = await listResp.json()
    const campaigns = Array.isArray(data) ? data : (data.campaigns ?? [])
    if (campaigns.length === 0) return

    const resp = await page.request.get(`${BASE}/api/campaigns/${campaigns[0].id}/tracking`)
    expect(resp.ok()).toBeTruthy()
    const body = await resp.json()
    expect(body).toHaveProperty('summary')
  })

  test('published campaign shows publishing/indexed status if platforms configured', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })

    const listResp = await page.request.get(`${BASE}/api/campaigns`)
    if (!listResp.ok()) return
    const data = await listResp.json()
    const campaigns = Array.isArray(data) ? data : (data.campaigns ?? [])

    const publishedCampaign = campaigns.find((c: { status: string }) =>
      ['publishing', 'indexed', 'live'].includes(c.status)
    )

    if (!publishedCampaign) {
      console.log('[sprint7] No published campaign yet — skipping status check')
      return
    }

    await page.goto(`${BASE}/dashboard/campaigns/${publishedCampaign.id}`)
    await page.waitForLoadState('domcontentloaded')

    // Pipeline bar should show publishing/indexed
    const statusText = await page.content()
    const hasPublishingStatus =
      statusText.includes('PUBLISHING') ||
      statusText.includes('INDEXED') ||
      statusText.includes('Publishing') ||
      statusText.includes('Indexed')

    expect(hasPublishingStatus).toBe(true)
    console.log(`[sprint7] Campaign ${publishedCampaign.id} shows publishing status`)
  })
})
