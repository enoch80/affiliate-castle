/**
 * Intercepts Pexels internal API calls to get real photo IDs.
 * Pexels uses a JSON API internally to populate the search grid.
 */
import { chromium } from 'playwright'
import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROMIUM = '/tmp/pw-browsers/chromium-1117/chrome-linux/chrome'
const outDir = path.join(__dirname, 'tmp', 'pexels-api')
fs.mkdirSync(outDir, { recursive: true })

async function searchPexels(queries) {
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage']
  })
  
  const results = {}
  
  for (const query of queries) {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      proxy: { server: 'gw.dataimpulse.com:823', username: '918099f23f7baa58e1b8', password: 'fa4bd2593abef583' },
      viewport: { width: 1280, height: 800 },
    })
    const page = await context.newPage()
    
    const capturedPhotos = []
    const capturedImageIds = new Set()
    
    // Intercept ALL responses to find JSON photo data
    page.on('response', async (res) => {
      const url = res.url()
      const ct = res.headers()['content-type'] || ''
      
      // Capture Pexels CDN images (this tells us what IDs are being loaded)
      const imgMatch = url.match(/images\.pexels\.com\/photos\/(\d{5,10})\//)
      if (imgMatch) capturedImageIds.add(parseInt(imgMatch[1]))
      
      // Capture JSON API responses  
      if (ct.includes('json') && (url.includes('pexels') || url.includes('api'))) {
        try {
          const body = await res.text()
          // Look for photo objects with id field
          const photoMatches = body.match(/"id":(\d{5,10}).*?"photographer"/g)
          if (photoMatches) {
            photoMatches.forEach(m => {
              const idMatch = m.match(/"id":(\d+)/)
              if (idMatch) capturedPhotos.push(parseInt(idMatch[1]))
            })
          }
          // Also save the raw JSON for manual inspection
          if (body.length > 1000 && body.length < 200000) {
            fs.writeFileSync(path.join(outDir, `api-${query.replace(/\s+/g,'_').slice(0,20)}-${Date.now()}.json`), body.slice(0, 50000))
          }
        } catch {}
      }
    })

    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false })
      window.chrome = { runtime: {} }
    })
    
    try {
      const url = `https://www.pexels.com/search/${encodeURIComponent(query)}/`
      console.log(`Searching: "${query}"`)
      
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      // Wait for images to start loading
      await page.waitForTimeout(4000)
      
      // Scroll to trigger more image loads
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, 800))
        await page.waitForTimeout(500)
      }
      await page.waitForTimeout(2000)
      
      const title = await page.title()
      console.log(`  Title: ${title.substring(0, 60)}`)
      
      // Get image src IDs from rendered DOM
      const domIds = await page.evaluate(() => {
        const imgs = document.querySelectorAll('img[src*="images.pexels.com"]')
        return [...imgs].map(img => {
          const m = img.src.match(/\/photos\/(\d{5,10})\//)
          return m ? parseInt(m[1]) : null
        }).filter(Boolean)
      })
      
      domIds.forEach(id => capturedImageIds.add(id))
      
      await page.screenshot({ path: path.join(outDir, `screen-${query.replace(/\s+/g,'_').slice(0,20)}.png`) })
      
      const fromApi = capturedPhotos.length > 0 ? [...new Set(capturedPhotos)] : []
      const fromImages = [...capturedImageIds].filter(id => id >= 100000)
      
      console.log(`  API photos: ${fromApi.length}, Image IDs: ${fromImages.length}`)
      console.log(`  → API: ${fromApi.slice(0,5).join(', ')}`)
      console.log(`  → IMG: ${fromImages.slice(0,5).join(', ')}`)
      
      results[query] = {
        from_api: fromApi,
        from_images: fromImages,
        all: [...new Set([...fromApi, ...fromImages])]
      }
      
    } catch (e) {
      console.log(`  Error: ${e.message.substring(0, 100)}`)
      results[query] = { from_api: [], from_images: [], all: [] }
    }
    
    await context.close()
    await new Promise(r => setTimeout(r, 1500))
  }
  
  await browser.close()
  return results
}

async function downloadThumb(id) {
  const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=400`
  const outPath = path.join(outDir, `${id}.jpg`)
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 5000) return outPath
  
  return new Promise((resolve) => {
    const file = fs.createWriteStream(outPath)
    https.get(url, { timeout: 8000 }, (res) => {
      if (res.statusCode !== 200) { file.close(); try { fs.unlinkSync(outPath) } catch {} resolve(null); return }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve(outPath) })
    }).on('error', () => { file.close(); resolve(null) })
  })
}

async function main() {
  console.log('Searching Pexels via API interception...\n')
  
  const queries = [
    'home workshop woodworking tools',
    'craftsman woodworking hobby'
  ]
  
  const results = await searchPexels(queries)
  
  // Collect all IDs
  const allIds = new Set()
  for (const r of Object.values(results)) {
    r.all.forEach(id => allIds.add(id))
  }
  
  console.log(`\nTotal unique IDs: ${allIds.size}`)
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 2))
  
  // Download thumbnails
  if (allIds.size > 0) {
    console.log('Downloading thumbnails...')
    const ok = []
    for (const id of [...allIds]) {
      const p = await downloadThumb(id)
      if (p) { ok.push(id); process.stdout.write('↓') }
      else process.stdout.write('✗')
    }
    process.stdout.write('\n')
    console.log(`✅ ${ok.length} thumbnails. IDs: ${ok.join(', ')}`)
  } else {
    console.log('No IDs found. Check JSON files in:', outDir)
    const jsonFiles = fs.readdirSync(outDir).filter(f => f.endsWith('.json') && f.startsWith('api-'))
    console.log('API JSON files:', jsonFiles)
  }
}

main().catch(console.error)
