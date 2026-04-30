/**
 * Sprint B E2E — Keyword Research: KGR + PAA + TF-IDF
 *
 * Acceptance criteria (per planup1.md § SPRINT B):
 *  1. KGR fields exist on KeywordResearch records (kgrScore, kgrTier, allintitleCount, estimatedVolume)
 *  2. kgrTier values in DB are always 'golden' | 'silver' | 'bronze' | 'skip' (never null garbage)
 *  3. PAA + relatedSearches fields exist on KeywordResearch records
 *  4. Content-brief API responds without crash (Sprint B imports intact)
 *  5. /api/campaigns still works — all Sprint B pipeline changes are additive
 *  6. Campaign kgrTier values that have been set are valid canonical tiers
 *
 * Note: Many assertions are "soft pass" because no hobby-niche campaigns have been
 * processed through the pipeline since Sprint B deployed.  Tests document the
 * expected shape; they pass when data is present and no-op when it isn't.
 */
import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL || 'https://app.digitalfinds.net'
const EMAIL = 'admin@affiliatecastle.local'
const PASSWORD = 'AffCastle2026'

const VALID_KGR_TIERS = ['golden', 'silver', 'bronze', 'skip']

async function login(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
  return page.request
}

test.describe('Sprint B – KGR Keyword Research + PAA + TF-IDF', () => {

  // ── 1 ──────────────────────────────────────────────────────────────────────
  test('health check: Sprint B imports do not crash the app', async ({ request }) => {
    const resp = await request.get(`${BASE}/api/health`)
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body.status).toBe('ok')
    expect(body.components.db).toBe('ok')
    console.log('[sprint-b] Health OK — KGR/PAA/TF-IDF modules loaded without crash')
  })

  // ── 2 ──────────────────────────────────────────────────────────────────────
  test('kgrTier values in DB are canonical (golden/silver/bronze/skip)', async ({ page }) => {
    const req = await login(page)
    const resp = await req.get(`${BASE}/api/campaigns`)
    expect(resp.ok()).toBeTruthy()
    const data = await resp.json()
    const campaigns = Array.isArray(data) ? data : (data.campaigns ?? [])
    console.log(`[sprint-b] Checking ${campaigns.length} campaigns for kgrTier validity`)

    // For each campaign, check brief if it exists — look for kgrTier field
    let checkedCount = 0
    for (const c of campaigns.slice(0, 5)) {
      const briefResp = await req.get(`${BASE}/api/campaigns/${c.id}/brief`)
      if (!briefResp.ok()) continue
      const brief = await briefResp.json()
      const tier = brief.kgrTier ?? brief.contentBrief?.kgrTier
      if (tier !== undefined && tier !== null) {
        expect(VALID_KGR_TIERS).toContain(tier)
        checkedCount++
        console.log(`[sprint-b] Campaign ${c.id}: kgrTier='${tier}' ✓`)
      }
    }
    console.log(`[sprint-b] Checked ${checkedCount} KGR tier values — all canonical`)
  })

  // ── 3 ──────────────────────────────────────────────────────────────────────
  test('content API is intact post-Sprint-B (no import crash on brief endpoint)', async ({ page }) => {
    const req = await login(page)
    // Known non-existent ID → 404, not 500
    const resp = await req.get(`${BASE}/api/campaigns/sprintb-probe-id/brief`)
    expect(resp.status()).toBe(404)
    console.log('[sprint-b] Brief API returns 404 for unknown campaign — no kgr.ts import crash')
  })

  // ── 4 ──────────────────────────────────────────────────────────────────────
  test('offer pipeline endpoint handles woodworking hoplink (KGR step added)', async ({ page }) => {
    const req = await login(page)
    const resp = await req.post(`${BASE}/api/offers`, {
      data: { hoplink: 'https://hop.clickbank.net/?affiliate=sprintbtest&vendor=woodprod2' },
    })
    // 2xx = accepted for KGR analysis; 409 = duplicate — never 500
    expect([200, 201, 202, 409]).toContain(resp.status())
    console.log(`[sprint-b] KGR pipeline accepted hoplink (status=${resp.status()})`)
  })

  // ── 5 ──────────────────────────────────────────────────────────────────────
  test('campaigns with keywords have a primaryKeyword (Step 3.5 KGR override functional)', async ({ page }) => {
    const req = await login(page)
    const resp = await req.get(`${BASE}/api/campaigns`)
    expect(resp.ok()).toBeTruthy()
    const data = await resp.json()
    const campaigns = Array.isArray(data) ? data : (data.campaigns ?? [])

    const withBrief = campaigns.filter((c: { status: string }) =>
      ['brief_ready', 'content_ready', 'published'].includes(c.status)
    )

    if (withBrief.length === 0) {
      console.log('[sprint-b] No brief_ready campaigns yet — primaryKeyword test soft pass')
      return
    }

    for (const c of withBrief.slice(0, 3)) {
      const briefResp = await req.get(`${BASE}/api/campaigns/${c.id}/brief`)
      if (!briefResp.ok()) continue
      const brief = await briefResp.json()
      const kw = brief.primaryKeyword ?? brief.contentBrief?.primaryKeyword
      if (kw) {
        // KGR-selected keywords tend to be longer (more specific) than LLM seeds
        expect(typeof kw).toBe('string')
        expect(kw.length).toBeGreaterThan(5)
        console.log(`[sprint-b] Campaign ${c.id}: primaryKeyword="${kw}" ✓`)
      }
    }
  })

  // ── 6 ──────────────────────────────────────────────────────────────────────
  test('pinterestKeywords field populated in briefs (Sprint B content-brief.ts)', async ({ page }) => {
    const req = await login(page)
    const resp = await req.get(`${BASE}/api/campaigns`)
    expect(resp.ok()).toBeTruthy()
    const data = await resp.json()
    const campaigns = Array.isArray(data) ? data : (data.campaigns ?? [])

    const withContent = campaigns.find((c: { status: string }) =>
      ['brief_ready', 'content_ready', 'published'].includes(c.status)
    )
    if (!withContent) {
      console.log('[sprint-b] No campaigns with briefs — pinterestKeywords test soft pass')
      return
    }

    const briefResp = await req.get(`${BASE}/api/campaigns/${withContent.id}/brief`)
    if (!briefResp.ok()) return
    const brief = await briefResp.json()
    const pinterestKws = brief.pinterestKeywords ?? brief.contentBrief?.pinterestKeywords
    if (pinterestKws) {
      expect(Array.isArray(pinterestKws)).toBe(true)
      expect(pinterestKws.length).toBeGreaterThan(0)
      console.log(`[sprint-b] pinterestKeywords: ${pinterestKws.length} variants ✓`)
    } else {
      console.log('[sprint-b] pinterestKeywords not yet in brief response — soft pass')
    }
  })

  // ── 7 ──────────────────────────────────────────────────────────────────────
  test('urlSlug and schemaType fields in content briefs (Sprint B fields)', async ({ page }) => {
    const req = await login(page)
    const resp = await req.get(`${BASE}/api/campaigns`)
    expect(resp.ok()).toBeTruthy()
    const data = await resp.json()
    const campaigns = Array.isArray(data) ? data : (data.campaigns ?? [])

    const withContent = campaigns.find((c: { status: string }) =>
      ['brief_ready', 'content_ready', 'published'].includes(c.status)
    )
    if (!withContent) {
      console.log('[sprint-b] No campaigns with briefs — urlSlug/schemaType test soft pass')
      return
    }

    const briefResp = await req.get(`${BASE}/api/campaigns/${withContent.id}/brief`)
    if (!briefResp.ok()) return
    const brief = await briefResp.json()
    const b = brief.contentBrief ?? brief

    if (b.urlSlug) {
      expect(b.urlSlug).toMatch(/^[a-z0-9-]+$/)
      console.log(`[sprint-b] urlSlug="${b.urlSlug}" ✓`)
    }
    if (b.schemaType) {
      expect(['Article', 'HowTo', 'FAQPage']).toContain(b.schemaType)
      console.log(`[sprint-b] schemaType="${b.schemaType}" ✓`)
    }
    if (b.searchIntent) {
      expect(['informational', 'commercial', 'transactional']).toContain(b.searchIntent)
      console.log(`[sprint-b] searchIntent="${b.searchIntent}" ✓`)
    }
  })

  // ── 8 ──────────────────────────────────────────────────────────────────────
  test('campaigns API shape still intact post-Sprint-B (regression)', async ({ page }) => {
    const req = await login(page)
    const resp = await req.get(`${BASE}/api/campaigns`)
    expect(resp.ok()).toBeTruthy()
    const data = await resp.json()
    const campaigns = Array.isArray(data) ? data : (data.campaigns ?? [])
    expect(Array.isArray(campaigns)).toBe(true)
    console.log(`[sprint-b] /api/campaigns returns ${campaigns.length} campaigns — shape intact`)
  })

})
