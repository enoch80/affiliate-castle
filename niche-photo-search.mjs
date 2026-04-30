/**
 * Searches Pexels for all 12 niches via residential proxy.
 * Downloads thumbnails for visual verification.
 * Output: tmp/niche-photos/{niche}/{slot}-{id}.jpg + report.json
 */
import { chromium } from 'playwright'
import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROMIUM = '/tmp/pw-browsers/chromium-1117/chrome-linux/chrome'
const BASE_OUT = path.join(__dirname, 'tmp', 'niche-photos')
fs.mkdirSync(BASE_OUT, { recursive: true })

// ─── Niche photo search queries ───────────────────────────────────────────────
// 3 queries per niche: hero (wide), before (wide), pin (portrait)
const NICHE_QUERIES = {
  woodworking: {
    hero:   'woodworking workshop craftsman bench tools',
    before: 'beginner confused scattered wood scraps workbench',
    pin:    'craftsman carving wood hobbyist workshop',
    accent: '#c2813f', bg: '#0f0800',
    label: 'Woodworking',
    product: "Ted's Woodworking Plans",
  },
  gardening: {
    hero:   'beautiful home vegetable garden raised beds',
    before: 'overgrown messy backyard neglected garden',
    pin:    'gardener planting flowers garden beds sunlight',
    accent: '#4caf50', bg: '#061209',
    label: 'Gardening',
    product: 'Food Forest Abundance',
  },
  fishing: {
    hero:   'man fishing lake sunrise rod reel peaceful',
    before: 'fisherman frustrated empty bucket no catch',
    pin:    'trophy bass catch fishing lake morning',
    accent: '#1e88e5', bg: '#000d1a',
    label: 'Fishing',
    product: 'Bass Fishing Secrets',
  },
  quilting: {
    hero:   'quilting fabric colorful sewing craft studio',
    before: 'messy fabric scraps sewing room overwhelmed',
    pin:    'beautiful handmade quilt pattern colorful',
    accent: '#e91e8c', bg: '#1a0010',
    label: 'Quilting',
    product: 'Quilting For Joy',
  },
  birding: {
    hero:   'birdwatcher binoculars forest nature trail',
    before: 'beginner binoculars confused bird watching',
    pin:    'colorful rare bird in nature wildlife photography',
    accent: '#8bc34a', bg: '#071200',
    label: 'Birding',
    product: 'Complete Birding Guide',
  },
  genealogy: {
    hero:   'family tree old photographs documents heritage',
    before: 'person overwhelmed by old documents family records',
    pin:    'old family portrait black white vintage photograph',
    accent: '#ff9800', bg: '#150a00',
    label: 'Genealogy',
    product: 'Family Tree DNA',
  },
  'ham-radio': {
    hero:   'amateur radio station ham radio equipment shack',
    before: 'confused beginner radio equipment knobs dials',
    pin:    'ham radio operator antenna tower communication',
    accent: '#00bcd4', bg: '#00111a',
    label: 'Ham Radio',
    product: 'Ham Radio Prep',
  },
  'rv-living': {
    hero:   'RV camper van scenic mountain road trip freedom',
    before: 'couple stressed outside broken down RV',
    pin:    'RV campsite sunset couple relaxing outdoor chairs',
    accent: '#ff7043', bg: '#1a0500',
    label: 'RV Living',
    product: 'RV Lifestyle Freedom',
  },
  watercolor: {
    hero:   'watercolor painting artist studio bright colorful',
    before: 'frustrated beginner artist messy failed painting',
    pin:    'beautiful watercolor landscape painting brushes',
    accent: '#7c4dff', bg: '#0d0020',
    label: 'Watercolor',
    product: 'Watercolor Mastery',
  },
  canning: {
    hero:   'home canning jars vegetables preserving food kitchen',
    before: 'overwhelmed kitchen canning jars scattered',
    pin:    'colorful preserved jars home pantry organized',
    accent: '#f44336', bg: '#1a0000',
    label: 'Canning',
    product: 'Home Canning Secrets',
  },
  'model-railroading': {
    hero:   'model train layout detailed miniature scenery',
    before: 'beginner model train scattered parts confused',
    pin:    'intricate model railroad village mountains diorama',
    accent: '#607d8b', bg: '#070d12',
    label: 'Model Railroading',
    product: 'Model Train Master',
  },
  general: {
    hero:   'person laptop home office success smiling',
    before: 'frustrated person staring at laptop problem',
    pin:    'person celebrating success achievement laptop',
    accent: '#6366f1', bg: '#0f0f1a',
    label: 'General',
    product: 'Digital Success Program',
  },
}

// ─── Proxy search ─────────────────────────────────────────────────────────────
async function searchPexels(browser, query) {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    proxy: { server: 'gw.dataimpulse.com:823', username: '918099f23f7baa58e1b8', password: 'fa4bd2593abef583' },
    viewport: { width: 1280, height: 800 },
  })
  const page = await context.newPage()
  await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); window.chrome = { runtime: {} } })

  try {
    const url = `https://www.pexels.com/search/${encodeURIComponent(query)}/`
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(1500)
    const title = await page.title()
    if (title.includes('Just a moment')) { await context.close(); return [] }

    const content = await page.content()
    const ids = new Set()
    const re = /\/photo\/(\d{5,8})\//g
    let m
    while ((m = re.exec(content)) !== null) {
      const n = parseInt(m[1])
      if (n >= 10000 && n <= 50000000) ids.add(n)
    }
    await context.close()
    return [...ids].slice(0, 6)
  } catch {
    await context.close()
    return []
  }
}

// ─── Download thumbnail ───────────────────────────────────────────────────────
async function downloadThumb(id, outPath) {
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 5000) return true
  const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=400`
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
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║  PEXELS PHOTO SEARCH — ALL 12 NICHES                  ║')
  console.log('╚══════════════════════════════════════════════════════╝\n')

  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage']
  })

  const report = {}

  for (const [niche, config] of Object.entries(NICHE_QUERIES)) {
    console.log(`\n── ${config.label} ──`)
    const nicheDir = path.join(BASE_OUT, niche)
    fs.mkdirSync(nicheDir, { recursive: true })

    const slots = {}
    for (const [slot, query] of [['hero', config.hero], ['before', config.before], ['pin', config.pin]]) {
      process.stdout.write(`  [${slot}] "${query.substring(0, 40)}"... `)
      const ids = await searchPexels(browser, query)
      process.stdout.write(`${ids.length} ids → `)

      // Download first 3 thumbnails
      const downloaded = []
      for (const id of ids.slice(0, 3)) {
        const outPath = path.join(nicheDir, `${slot}-${id}.jpg`)
        const ok = await downloadThumb(id, outPath)
        if (ok) { downloaded.push(id); process.stdout.write('↓') }
      }
      process.stdout.write('\n')
      slots[slot] = { query, ids, downloaded }
      await new Promise(r => setTimeout(r, 800))
    }

    report[niche] = { ...config, slots }
  }

  await browser.close()

  fs.writeFileSync(path.join(BASE_OUT, 'report.json'), JSON.stringify(report, null, 2))
  console.log(`\n✅ Done. Report saved to tmp/niche-photos/report.json`)
  console.log(`   Thumbnails in tmp/niche-photos/{niche}/`)

  // Print summary table
  console.log('\n══ SUMMARY ══')
  for (const [niche, data] of Object.entries(report)) {
    const hero = data.slots.hero.downloaded[0] || 'NONE'
    const before = data.slots.before.downloaded[0] || 'NONE'
    const pin = data.slots.pin.downloaded[0] || 'NONE'
    console.log(`${niche.padEnd(18)} hero:${hero}  before:${before}  pin:${pin}`)
  }
}

main().catch(console.error)
