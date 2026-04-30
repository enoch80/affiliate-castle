/**
 * Extract Pexels photo IDs from image src URLs in search results
 * The src format is: https://images.pexels.com/photos/ID/pexels-photo-ID.jpeg...
 */
import { chromium } from 'playwright'
import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROMIUM = '/tmp/pw-browsers/chromium-1117/chrome-linux/chrome'
const outDir = path.join(__dirname, 'tmp', 'pexels-final')
fs.mkdirSync(outDir, { recursive: true })

async function searchPexels(query) {
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage']
  })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    proxy: { server: 'gw.dataimpulse.com:823', username: '918099f23f7baa58e1b8', password: 'fa4bd2593abef583' },
    viewport: { width: 1366, height: 900 },
  })
  const page = await context.newPage()
  
  // Collect image URLs from network requests 
  const pexelsImageIds = new Set()
  page.on('response', async (response) => {
    const url = response.url()
    const m = url.match(/images\.pexels\.com\/photos\/(\d{5,10})\//)
    if (m) pexelsImageIds.add(parseInt(m[1]))
  })
  
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
    window.chrome = { runtime: {} }
  })
  
  try {
    const url = `https://www.pexels.com/search/${encodeURIComponent(query)}/`
    console.log(`  Searching: "${query}"`)
    await page.goto(url, { waitUntil: 'networkidle', timeout: 35000 })
    await page.waitForTimeout(2000)
    
    const title = await page.title()
    if (title.includes('Just a moment')) {
      console.log(`  ⚠ Cloudflare`)
      await browser.close()
      return []
    }
    
    // Scroll to trigger lazy loading
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => window.scrollBy(0, 1500))
      await page.waitForTimeout(600)
    }
    
    // Also extract from page source
    const html = await page.content()
    const imgRe = /images\.pexels\.com\/photos\/(\d{5,10})\//g
    let m
    while ((m = imgRe.exec(html)) !== null) {
      pexelsImageIds.add(parseInt(m[1]))
    }
    
    // Extract from anchor hrefs (alternate format)
    const hrefRe = /\/photos\/(\d{5,10})-/g
    while ((m = hrefRe.exec(html)) !== null) {
      pexelsImageIds.add(parseInt(m[1]))  
    }
    
    const ids = [...pexelsImageIds].filter(id => id >= 100000 && id <= 50000000)
    console.log(`  → Found ${ids.length} IDs (from network + HTML)`)
    
    await page.screenshot({ path: path.join(outDir, `page-${query.replace(/\s+/g,'_').slice(0,20)}.png`) })
    
    await browser.close()
    return ids
    
  } catch (e) {
    console.log(`  Error: ${e.message.substring(0, 100)}`)
    try { await browser.close() } catch {}
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
    req.on('error', () => { file.close(); resolve(null) })
    req.on('timeout', () => { req.destroy(); file.close(); resolve(null) })
  })
}

async function main() {
  // Run searches for our key photo needs
  const searches = [
    'home workshop woodworking tools',
    'craftsman woodworking hobby',
    'woodworking plans blueprints',
  ]
  
  const allIds = new Set()
  
  for (const q of searches) {
    const ids = await searchPexels(q)
    ids.forEach(id => allIds.add(id))
    await new Promise(r => setTimeout(r, 1000))
  }
  
  console.log(`\nTotal: ${allIds.size} unique IDs`)
  
  // Download
  console.log('Downloading...')
  const ok = []
  for (const id of [...allIds]) {
    const p = await downloadThumb(id)
    if (p) { ok.push(id); process.stdout.write('↓') }
    else process.stdout.write('✗')
  }
  process.stdout.write('\n')
  
  console.log(`\n✅ ${ok.length} photos downloaded`)
  console.log('IDs:', ok.join(', '))
  
  fs.writeFileSync(path.join(outDir, 'ids.json'), JSON.stringify({ all: [...allIds], downloaded: ok }, null, 2))
}

main().catch(console.error)
