/**
 * Precise Pexels photo ID extractor using href="/photo/ID/" pattern
 * + direct inspection of photo links in the search results
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

async function searchPexelsExact(query, maxPhotos = 20) {
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
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
    window.chrome = { runtime: {} }
  })
  
  try {
    const url = `https://www.pexels.com/search/${encodeURIComponent(query)}/`
    console.log(`  Searching: "${query}"`)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
    
    const title = await page.title()
    if (title.includes('Just a moment') || title.includes('Cloudflare')) {
      console.log(`  ⚠ Cloudflare blocked`)
      await browser.close()
      return []
    }
    
    // Scroll to load more photos
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 2000))
      await page.waitForTimeout(800)
    }
    
    // Extract photo IDs from actual photo links (href="/photo/1234567/")
    const ids = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/photo/"]'))
      const ids = new Set()
      links.forEach(link => {
        const m = link.href.match(/\/photo\/(\d{5,10})\//)
        if (m) ids.add(parseInt(m[1]))
      })
      return [...ids]
    })
    
    console.log(`  → Found ${ids.length} photo IDs`)
    
    // Take screenshot for reference
    await page.screenshot({ path: path.join(outDir, `search-${query.replace(/\s+/g, '-').substring(0, 30)}.png`) })
    
    await browser.close()
    return ids.slice(0, maxPhotos)
    
  } catch (e) {
    console.log(`  Error: ${e.message.substring(0, 80)}`)
    await browser.close()
    return []
  }
}

async function downloadThumb(id, size = 400) {
  const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${size}`
  const outPath = path.join(outDir, `${id}.jpg`)
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 5000) return outPath
  
  return new Promise((resolve) => {
    const file = fs.createWriteStream(outPath)
    const req = https.get(url, { timeout: 10000 }, (res) => {
      if (res.statusCode !== 200) { file.close(); try { fs.unlinkSync(outPath) } catch {} resolve(null); return }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve(outPath) })
    })
    req.on('error', () => { file.close(); resolve(null) })
    req.on('timeout', () => { req.destroy(); file.close(); resolve(null) })
  })
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║  PEXELS WOODWORKING PHOTO SEARCH (Precise Extractor)  ║')
  console.log('╚══════════════════════════════════════════════════════╝\n')

  // Targeted search queries for each slot
  const searches = [
    { slot: 'bridge_hero', query: 'home workshop woodworking tools', desc: 'Wide: cozy workshop with tools on bench' },
    { slot: 'plans_blueprints', query: 'woodworking plans blueprints workshop', desc: 'Portrait: wood plans being unrolled' },
    { slot: 'man_working', query: 'man woodworking hobby garage', desc: 'Portrait: man working on wood project' },
    { slot: 'craftsman_hands', query: 'craftsman hands woodworking', desc: 'Portrait: hands working with wood' },
    { slot: 'dark_texture', query: 'dark wood texture workshop', desc: 'Wide: dark wood or workshop, for overlay BG' },
    { slot: 'finished_project', query: 'finished wooden furniture outdoor', desc: 'Wide: finished wood project, outdoor' },
  ]
  
  const allSlotIds = {}
  const allIds = new Set()
  
  for (const { slot, query, desc } of searches) {
    console.log(`\n[${slot}] ${desc}`)
    const ids = await searchPexelsExact(query, 15)
    allSlotIds[slot] = ids
    ids.forEach(id => allIds.add(id))
    await new Promise(r => setTimeout(r, 500))
  }
  
  console.log(`\n\nAll unique IDs: ${[...allIds].join(', ')}`)
  
  // Download all thumbnails
  console.log('\nDownloading thumbnails...')
  const downloaded = []
  for (const id of [...allIds]) {
    const p = await downloadThumb(id)
    if (p) { downloaded.push(id); process.stdout.write('↓') }
    else process.stdout.write('✗')
  }
  process.stdout.write('\n')
  
  // Save report
  const report = { searches: allSlotIds, all_ids: [...allIds], downloaded }
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2))
  
  console.log(`\n✅ ${downloaded.length} thumbnails saved to: ${outDir}`)
  console.log('\nIDs by slot:')
  for (const [slot, ids] of Object.entries(allSlotIds)) {
    console.log(`  [${slot}]: ${ids.slice(0, 10).join(', ')}`)
  }
}

main().catch(console.error)
