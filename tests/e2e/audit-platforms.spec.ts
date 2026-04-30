/**
 * Platform Audit — human-click style
 * Logs in, visits Settings, clicks every Test Connection button,
 * navigates to Channels, and captures screenshots + console logs.
 * Run: BASE_URL=https://app.digitalfinds.net npx playwright test tests/e2e/audit-platforms.spec.ts --project=chromium --reporter=list
 */

import { test, expect, Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const SCREENSHOT_DIR = '/tmp/audit'
const BASE = process.env.BASE_URL || 'https://app.digitalfinds.net'

async function login(page: Page) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', 'admin@affiliatecastle.local')
  await page.fill('input[type="password"]', 'AffCastle2026')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/dashboard/, { timeout: 20000 })
}

function screenshot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  return page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true })
}

test.describe('Platform Audit', () => {
  test.setTimeout(180000)

  test('01 – settings page full render', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('pageerror', (e) => consoleErrors.push(`PAGEERROR: ${e.message}`))

    await login(page)
    await page.goto(`${BASE}/dashboard/settings`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)
    await screenshot(page, '01-settings-full')

    console.log('=== CONSOLE ERRORS ===')
    consoleErrors.forEach((e) => console.log('  ERR:', e))
    console.log('=== END ERRORS ===')

    // Count cards
    const cards = await page.locator('.bg-slate-800.border.border-slate-700.rounded-2xl').count()
    console.log('Platform cards rendered:', cards)

    // Count connected vs not
    const connected = await page.locator('text=Connected').count()
    const notConnected = await page.locator('text=Not connected').count()
    const setupRequired = await page.locator('text=Admin setup required').count()
    console.log(`Connected: ${connected} | Not connected: ${notConnected} | Setup required: ${setupRequired}`)
  })

  test('02 – test each connected platform', async ({ page }) => {
    const results: Array<{ platform: string; result: string }> = []
    await login(page)
    await page.goto(`${BASE}/dashboard/settings`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)

    // Get all "Test Connection" buttons
    const testBtns = page.locator('button:has-text("Test Connection")')
    const count = await testBtns.count()
    console.log(`Found ${count} Test Connection buttons`)

    for (let i = 0; i < count; i++) {
      // Re-query each time (DOM may have changed)
      const btn = page.locator('button:has-text("Test Connection")').nth(i)
      const card = btn.locator('xpath=ancestor::div[contains(@class,"bg-slate-800")]')
      const platformName = await card.locator('h3').first().textContent().catch(() => `platform-${i}`)
      
      console.log(`Testing platform: ${platformName?.trim()}`)
      await btn.scrollIntoViewIfNeeded()
      await btn.click()
      await page.waitForTimeout(3500) // wait for API round-trip

      // Capture the result message
      const msgEl = card.locator('[class*="rounded-lg"][class*="text-xs"]').last()
      const msgText = await msgEl.textContent().catch(() => '')
      results.push({ platform: platformName?.trim() ?? `platform-${i}`, result: msgText?.trim() ?? '' })
      console.log(`  Result: ${msgText?.trim() || '(no message)'}`)
      await screenshot(page, `02-test-${(platformName ?? `p${i}`).trim().toLowerCase().replace(/[^a-z0-9]/g, '-')}`)
    }

    console.log('\n=== TEST RESULTS SUMMARY ===')
    results.forEach((r) => console.log(`  ${r.platform}: ${r.result}`))
    console.log('=== END SUMMARY ===')
  })

  test('03 – blogger and pinterest cards (setup required check)', async ({ page }) => {
    await login(page)
    await page.goto(`${BASE}/dashboard/settings`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)

    const bloggerCard = page.locator('h3:has-text("Blogger")').locator('xpath=ancestor::div[contains(@class,"bg-slate-800")]')
    const pinterestCard = page.locator('h3:has-text("Pinterest")').locator('xpath=ancestor::div[contains(@class,"bg-slate-800")]')

    const bloggerText = await bloggerCard.textContent().catch(() => '')
    const pinterestText = await pinterestCard.textContent().catch(() => '')

    console.log('Blogger card text:', bloggerText?.replace(/\s+/g, ' ').trim())
    console.log('Pinterest card text:', pinterestText?.replace(/\s+/g, ' ').trim())
    await screenshot(page, '03-blogger-pinterest-cards')
  })

  test('04 – channels page (Telegram)', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('pageerror', (e) => consoleErrors.push(`PAGEERROR: ${e.message}`))

    await login(page)
    await page.goto(`${BASE}/dashboard/channels`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)

    await screenshot(page, '04-channels-page')
    console.log('Channels page title:', await page.title())

    // Check for any error banners
    const errBanners = await page.locator('[class*="red"], [class*="error"]').allTextContents()
    console.log('Error banners:', errBanners.filter((t) => t.trim()))

    // Check channel list
    const channelItems = await page.locator('[class*="channel"], [class*="Channel"]').count()
    console.log('Channel elements found:', channelItems)

    console.log('=== CHANNELS CONSOLE ERRORS ===')
    consoleErrors.forEach((e) => console.log('  ERR:', e))
  })

  test('05 – navigate dashboard pages for errors', async ({ page }) => {
    const consoleErrors: Record<string, string[]> = {}
    page.on('console', (m) => {
      if (m.type() === 'error') {
        const url = page.url()
        if (!consoleErrors[url]) consoleErrors[url] = []
        consoleErrors[url].push(m.text())
      }
    })

    await login(page)

    const pages = [
      '/dashboard',
      '/dashboard/settings',
      '/dashboard/channels',
    ]

    for (const p of pages) {
      await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(2000)
      const name = p.replace(/\//g, '-').replace(/^-/, '')
      await screenshot(page, `05-${name}`)
      console.log(`Page ${p}: loaded OK`)
    }

    console.log('\n=== PER-PAGE CONSOLE ERRORS ===')
    for (const [url, errs] of Object.entries(consoleErrors)) {
      console.log(`  ${url}:`)
      errs.forEach((e) => console.log(`    ${e}`))
    }
  })

  test('06 – settings page API responses', async ({ page }) => {
    const apiResponses: Array<{ url: string; status: number; body: string }> = []

    page.on('response', async (res) => {
      const url = res.url()
      if (url.includes('/api/settings') || url.includes('/api/channels')) {
        try {
          const body = await res.text()
          apiResponses.push({ url, status: res.status(), body: body.slice(0, 500) })
        } catch {}
      }
    })

    await login(page)
    await page.goto(`${BASE}/dashboard/settings`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)

    console.log('\n=== SETTINGS API RESPONSES ===')
    for (const r of apiResponses) {
      console.log(`  ${r.status} ${r.url}`)
      console.log(`  BODY: ${r.body}`)
    }

    await screenshot(page, '06-settings-api-audit')
  })
})
