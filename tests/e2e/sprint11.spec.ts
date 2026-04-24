/**
 * Sprint 11 E2E — Security: rate limiting, Zod validation, settings API, auth fixes
 *
 * Verification criteria:
 *   - GET /api/settings requires auth (401)
 *   - POST /api/settings requires auth (401)
 *   - POST /api/settings rejects invalid platform (400 + validation issues)
 *   - POST /api/settings rejects empty credentials (400)
 *   - POST /api/settings saves encrypted credential (response never includes raw credential)
 *   - GET /api/settings list is safe (no credentialsEncrypted field in response)
 *   - POST /api/t/click with missing shortCode returns 400
 *   - POST /api/t/optin with invalid email returns 400
 *   - POST /api/t/optin missing campaignId returns 400
 *   - GET /api/campaigns/:id/rankings requires auth (401) — authOptions fix regression
 *
 * Regression rule: all sprint 1–10 tests must still pass.
 */
import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://109.199.106.147:3200'
const EMAIL = 'admin@affiliatecastle.local'
const PASSWORD = 'AffCastle2026'

test.describe('Sprint 11 – Security', () => {
  // ── 1 ──────────────────────────────────────────────────────────────────────
  test('health check still returns ok (regression)', async ({ request }) => {
    const resp = await request.get(`${BASE}/api/health`)
    expect(resp.status()).toBe(200)
    expect((await resp.json()).status).toBe('ok')
  })

  // ── 2 ──────────────────────────────────────────────────────────────────────
  test('GET /api/settings requires auth (401)', async ({ request }) => {
    const resp = await request.get(`${BASE}/api/settings`)
    expect(resp.status()).toBe(401)
  })

  // ── 3 ──────────────────────────────────────────────────────────────────────
  test('POST /api/settings requires auth (401)', async ({ request }) => {
    const resp = await request.post(`${BASE}/api/settings`, {
      data: { platform: 'devto', username: 'test', credentials: 'secret' },
    })
    expect(resp.status()).toBe(401)
  })

  // ── 4 ──────────────────────────────────────────────────────────────────────
  test('POST /api/settings rejects invalid platform (400)', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })

    const resp = await page.request.post(`${BASE}/api/settings`, {
      data: { platform: 'unsupported_platform_xyz', username: 'test', credentials: 'secret' },
    })
    expect(resp.status()).toBe(400)
    const body = await resp.json()
    expect(body).toHaveProperty('error')
  })

  // ── 5 ──────────────────────────────────────────────────────────────────────
  test('POST /api/settings rejects empty credentials (400)', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })

    const resp = await page.request.post(`${BASE}/api/settings`, {
      data: { platform: 'devto', username: 'testuser', credentials: '' },
    })
    expect(resp.status()).toBe(400)
    const body = await resp.json()
    expect(body).toHaveProperty('issues')
    expect(Array.isArray(body.issues)).toBe(true)
  })

  // ── 6 ──────────────────────────────────────────────────────────────────────
  test('POST /api/settings stores credential encrypted (response has no raw credential)', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })

    const resp = await page.request.post(`${BASE}/api/settings`, {
      data: {
        platform: 'devto',
        username: `qa_test_${Date.now()}`,
        credentials: 'super_secret_api_key_12345',
      },
    })
    // Either 200 (update) or 201 (create) — both are success
    expect([200, 201]).toContain(resp.status())
    const body = await resp.json()
    expect(body.ok).toBe(true)
    expect(body).toHaveProperty('account')
    // Raw credential must NOT be in the response
    expect(JSON.stringify(body)).not.toContain('super_secret_api_key_12345')
    // credentialsEncrypted must NOT be in the response
    expect(body.account).not.toHaveProperty('credentialsEncrypted')
  })

  // ── 7 ──────────────────────────────────────────────────────────────────────
  test('GET /api/settings list does not expose credentialsEncrypted', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })

    const resp = await page.request.get(`${BASE}/api/settings`)
    expect(resp.ok()).toBeTruthy()
    const body = await resp.json()
    expect(body).toHaveProperty('accounts')
    expect(Array.isArray(body.accounts)).toBe(true)
    // Ensure no account exposes credentialsEncrypted
    for (const account of body.accounts) {
      expect(account).not.toHaveProperty('credentialsEncrypted')
    }
  })

  // ── 8 ──────────────────────────────────────────────────────────────────────
  test('POST /api/t/click with missing shortCode returns 400', async ({ request }) => {
    const resp = await request.post(`${BASE}/api/t/click`, {
      data: { referrer: 'https://example.com' },
    })
    expect(resp.status()).toBe(400)
    const body = await resp.json()
    expect(body).toHaveProperty('error')
  })

  // ── 9 ──────────────────────────────────────────────────────────────────────
  test('POST /api/t/optin with invalid email returns 400', async ({ request }) => {
    // Use a private test IP so this call doesn't share the rate-limit bucket
    const resp = await request.post(`${BASE}/api/t/optin`, {
      data: { email: 'not-an-email', campaignId: 'cid_test' },
      headers: { 'x-forwarded-for': '10.99.2.1' },
    })
    expect(resp.status()).toBe(400)
    const body = await resp.json()
    expect(body).toHaveProperty('error')
  })

  // ── 10 ─────────────────────────────────────────────────────────────────────
  test('GET /api/campaigns/:id/rankings requires auth (401) — authOptions regression', async ({ request }) => {
    // Use a plausible but not real campaign ID — the endpoint should return 401 before any DB lookup
    const resp = await request.get(`${BASE}/api/campaigns/nonexistent-campaign-id/rankings`)
    expect(resp.status()).toBe(401)
  })
})
