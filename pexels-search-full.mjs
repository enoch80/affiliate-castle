/**
 * Extended Pexels search via residential proxy for all required photo slots.
 * Searches multiple woodworking topics.
 */
import { chromium } from 'playwright'
import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROMIUM = '/tmp/pw-browsers/chromium-1117/chrome-linux/chrome'
const outDir = path.join(__dirname, 'tmp', 'pexels-search')
fs.mkdirSync(outDir, { recursive: true })

async function searchPexels(browser, query) {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    proxy: { server: 'gw.dataimpulse.com:823', username: '918099f23f7baa58e1b8', password: 'fa4bd2593abef583' },
    viewport: { width: 1366, height: 768 },
  })
  const page = await context.newPage()
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
    window.chrome = { runtime: {} }
  })
  
  try {
    const url = `https://www.pexels.com/search/${encodeURIComponent(query)}/`
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(2000)
    
    const title = await page.title()
    console.log(`  "${query}" → title: ${title.substring(0, 60)}`)
    
    if (title.includes('Just a moment') || title.includes('Cloudflare')) {
      await context.close()
      return []
    }
    
    const content = await page.content()
    await page.screenshot({ path: path.join(outDir, `search-${query.replace(/\s+/g, '-')}.png`) })
    
    const ids = new Set()
    const re = /\/photo\/(\d{5,8})\//g
    let m
    while ((m = re.exec(content)) !== null) {
      const n = parseInt(m[1])
      if (n >= 10000 && n <= 50000000) ids.add(n)
    }
    
    await context.close()
    return [...ids]
  } catch (e) {
    console.log(`  Error: ${e.message.substring(0, 80)}`)
    await context.close()
    return []
  }
}

async function downloadThumb(id) {
  const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=400`
  const outPath = path.join(outDir, `${id}.jpg`)
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 5000) return true
  
  return new Promise((resolve) => {
    const file = fs.createWriteStream(outPath)
    const req = https.get(url, { timeout: 8000 }, (res) => {
      if (res.statusCode !== 200) { file.close(); try { fs.unlinkSync(outPath) } catch {} resolve(false); return }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve(true) })
    })
    req.on('error', () => { file.close(); resolve(false) })
    req.on('timeout', () => { req.destroy(); file.close(); resolve(false) })
  })
}

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage']
  })

  const searches = {
    'hero_workshop': 'home workshop woodworking',
    'carpenter_working': 'carpenter woodworking tools',
    'woodsman_project': 'man woodworking hobby garage',
    'plans_blueprints': 'woodworking plans blueprints',
    'wood_project_finished': 'wooden furniture outdoor chair',
    'dark_workshop': 'dark workshop interior',
    'wood_texture': 'dark wood grain texture',
    'tools_bench': 'tools on workbench workshop',
    'retiree_woodworking': 'senior man building wood project',
    'craftsman_hands': 'craftsman hands working wood',
  }
  
  const allResults = {}
  
  for (const [slot, query] of Object.entries(searches)) {
    const ids = await searchPexels(browser, query)
    allResults[slot] = { query, ids }
    console.log(`  → ${ids.length} IDs for "${slot}"`)
    if (ids.length === 0) await new Promise(r => setTimeout(r, 3000))
    else await new Promise(r => setTimeout(r, 1000))
  }
  
  await browser.close()
  
  // Collect all unique IDs
  const allIds = new Set()
  for (const { ids } of Object.values(allResults)) ids.forEach(id => allIds.add(id))
  console.log(`\nTotal unique IDs: ${allIds.size}`)
  
  // Download all thumbnails
  console.log('Downloading thumbnails...')
  const success = []
  for (const id of [...allIds]) {
    const ok = await downloadThumb(id)
    if (ok) { success.push(id); process.stdout.write('↓') }
    else process.stdout.write('✗')
  }
  process.stdout.write('\n')
  
  // Save report
  const report = { searches: allResults, all_ids: [...allIds], downloaded: success }
  fs.writeFileSync(path.join(outDir, 'search-report.json'), JSON.stringify(report, null, 2))
  
  console.log(`\n✅ ${success.length} thumbnails downloaded to: ${outDir}`)
  console.log('IDs by slot:')
  for (const [slot, { query, ids }] of Object.entries(allResults)) {
    if (ids.length > 0) console.log(`  [${slot}] ids: ${ids.slice(0, 8).join(', ')}${ids.length > 8 ? '...' : ''}`)
  }
}

main().catch(console.error)
