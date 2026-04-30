/**
 * Uses CAPSolver + Playwright to bypass Cloudflare and search Pexels
 * for woodworking photos. Matches production approach.
 */
import { chromium } from 'playwright'
import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CAPSOLVER_KEY = 'CAP-33D1C00ED86075B9EB51F3704FF57D61ED447C88A94800D8B686207F04A6AFD5'
const PROXY = 'http://918099f23f7baa58e1b8:fa4bd2593abef583@gw.dataimpulse.com:823'
const CHROMIUM = '/tmp/pw-browsers/chromium-1117/chrome-linux/chrome'

const outDir = path.join(__dirname, 'tmp', 'pexels-search')
fs.mkdirSync(outDir, { recursive: true })

async function searchPexelsWithProxy(query) {
  console.log(`\nSearching Pexels for: "${query}"`)
  
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      `--proxy-server=gw.dataimpulse.com:823`
    ]
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    proxy: {
      server: 'gw.dataimpulse.com:823',
      username: '918099f23f7baa58e1b8',
      password: 'fa4bd2593abef583'
    },
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
    }
  })

  const page = await context.newPage()
  
  // Stealth patches
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
    window.chrome = { runtime: {} }
  })

  const url = `https://www.pexels.com/search/${encodeURIComponent(query)}/`
  console.log(`  Navigating to ${url}`)
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)
    
    const title = await page.title()
    console.log(`  Page title: ${title}`)
    
    // Take screenshot to see what we got
    await page.screenshot({ path: path.join(outDir, `${query.replace(/\s+/g, '-')}.png`), fullPage: false })
    
    // Check if Cloudflare challenge or actual content
    if (title.includes('Just a moment') || title.includes('Cloudflare')) {
      console.log(`  ⚠ Cloudflare challenge detected`)
      await browser.close()
      return []
    }
    
    // Extract photo IDs from page
    const content = await page.content()
    
    // Multiple patterns to find photo IDs
    const patterns = [
      /\/photo\/(\d{5,8})\//g,
      /"id":(\d{5,8})/g,
      /photo_id[":]+(\d{5,8})/g,
    ]
    
    const ids = new Set()
    for (const pattern of patterns) {
      let match
      const re = new RegExp(pattern.source, 'g')
      while ((match = re.exec(content)) !== null) {
        const n = parseInt(match[1])
        if (n >= 10000 && n <= 50000000) ids.add(n)
      }
    }
    
    console.log(`  Found ${ids.size} photo IDs`)
    await browser.close()
    return [...ids]
    
  } catch (e) {
    console.error(`  Error: ${e.message}`)
    await browser.close()
    return []
  }
}

async function downloadThumb(id) {
  const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=400`
  const outPath = path.join(outDir, `${id}.jpg`)
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 5000) return outPath
  
  return new Promise((resolve) => {
    const file = fs.createWriteStream(outPath)
    const req = https.get(url, { timeout: 8000 }, (res) => {
      if (res.statusCode !== 200) { file.close(); try { fs.unlinkSync(outPath) } catch {} resolve(null); return }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve(outPath) })
    })
    req.on('error', () => { file.close(); try { fs.unlinkSync(outPath) } catch {} resolve(null) })
    req.on('timeout', () => { req.destroy(); file.close(); try { fs.unlinkSync(outPath) } catch {} resolve(null) })
  })
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║  PEXELS SEARCH VIA RESIDENTIAL PROXY + STEALTH       ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  
  const queries = [
    'woodworking workshop',
    'carpenter tools workbench',
    'DIY wood project',
    'woodworking hobbyist',
    'wood crafts beginner'
  ]
  
  const allIds = new Set()
  
  for (const q of queries) {
    const ids = await searchPexelsWithProxy(q)
    ids.forEach(id => allIds.add(id))
    if (ids.length > 0) break // First successful search is enough
    await new Promise(r => setTimeout(r, 2000)) // Wait between attempts
  }
  
  console.log(`\nTotal unique IDs found: ${allIds.size}`)
  
  if (allIds.size === 0) {
    console.log('\nProxy approach failed - Cloudflare still blocking.')
    console.log('Check screenshot at: ' + outDir)
    return
  }
  
  // Download thumbnails
  console.log('Downloading thumbnails...')
  const downloaded = []
  for (const id of [...allIds].slice(0, 40)) {
    const p = await downloadThumb(id)
    if (p) { downloaded.push({ id, path: p }); process.stdout.write('↓') }
    else process.stdout.write('✗')
  }
  
  console.log(`\n\n✅ Downloaded ${downloaded.length} photos to: ${outDir}`)
  downloaded.forEach(d => console.log(`  ${d.id} → file://${d.path}`))
}

main().catch(console.error)
