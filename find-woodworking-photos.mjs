/**
 * Mimics production LLM → photo selection pipeline.
 * 1. Calls Mistral via OpenRouter to get photo slot guidance
 * 2. Probes Pexels CDN for candidate IDs near known good ones
 * 3. Outputs confirmed working IDs with thumbnails for review
 */
import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const OPENROUTER_API_KEY = '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'
const OPENROUTER_MODEL = 'mistralai/mistral-small-3.2-24b-instruct'

// ─── Step 1: Ask Mistral for photo strategy ───────────────────────────────────
async function askMistral(prompt) {
  const body = JSON.stringify({
    model: OPENROUTER_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 800
  })

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://app.digitalfinds.net',
        'X-Title': 'Affiliate Castle Photo Selector'
      }
    }, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve(json.choices?.[0]?.message?.content || '')
        } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ─── Step 2: Check if a Pexels photo ID returns a real image ─────────────────
async function checkPexelsId(id) {
  const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=300`
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD', timeout: 6000 }, (res) => {
      const ok = res.statusCode === 200
      const size = parseInt(res.headers['content-length'] || '0')
      resolve({ id, ok, size, status: res.statusCode })
    })
    req.on('error', () => resolve({ id, ok: false, size: 0, status: 0 }))
    req.on('timeout', () => { req.destroy(); resolve({ id, ok: false, size: 0, status: 0 }) })
    req.end()
  })
}

// ─── Step 3: Download thumbnail ───────────────────────────────────────────────
async function downloadThumb(id, outDir) {
  const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=300`
  const outPath = path.join(outDir, `${id}.jpg`)
  if (fs.existsSync(outPath)) return outPath
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outPath)
    https.get(url, (res) => {
      if (res.statusCode !== 200) { file.close(); fs.unlinkSync(outPath); reject(new Error(`${res.statusCode}`)); return }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve(outPath) })
    }).on('error', (e) => { file.close(); try { fs.unlinkSync(outPath) } catch {} reject(e) })
  })
}

// ─── Step 4: Probe ranges of IDs ─────────────────────────────────────────────
async function probeRange(start, end, step = 1) {
  const results = []
  const ids = []
  for (let i = start; i <= end; i += step) ids.push(i)
  
  // Check in batches of 20
  for (let b = 0; b < ids.length; b += 20) {
    const batch = ids.slice(b, b + 20)
    const checks = await Promise.all(batch.map(id => checkPexelsId(id)))
    results.push(...checks.filter(r => r.ok && r.size > 10000))
    process.stdout.write(`.`)
  }
  process.stdout.write('\n')
  return results
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const outDir = path.join(__dirname, 'tmp', 'photo-candidates')
  fs.mkdirSync(outDir, { recursive: true })

  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log('║  PRODUCTION-IDENTICAL PHOTO SELECTION PIPELINE        ║')
  console.log('║  Model: ' + OPENROUTER_MODEL.padEnd(44) + '║')
  console.log('╚══════════════════════════════════════════════════════╝\n')

  // ── Ask Mistral exactly as production would ──────────────────────────────
  console.log('Step 1: Querying Mistral via OpenRouter (production model)...\n')
  const mistralPrompt = `You are the photo selection module for an affiliate marketing content pipeline for "Ted's Woodworking" — a 7-figure affiliate program targeting beginners and retirees who want to learn hobbyist woodworking.

I need specific Pexels.com stock photo IDs for these 7 slots:
1. BRIDGE HERO - A warm, inspiring home workshop. Hobbyist (not industrial). Tools on workbench, sawdust, warm lighting. WIDE/LANDSCAPE orientation.
2. BEFORE PHOTO - Beginner looking overwhelmed, messy table covered in scattered wood scraps, confused expression. WIDE/LANDSCAPE.
3. AFTER PHOTO - Same person or similar, proudly showing finished wooden project (Adirondack chair, small table, birdhouse). Outdoors or garage. WIDE/LANDSCAPE.
4. PINTEREST PIN 1 - "Secret Revealed" - Close-up of wooden plans/blueprints being unrolled on workbench. PORTRAIT 2:3.
5. PINTEREST PIN 2 - "Weekend Projects" - Man in his 50s-60s joyfully building a small wooden project in garage. PORTRAIT 2:3.
6. PINTEREST PIN 3 - "Ted's Method" - Artisan woodworker's hands holding finished wooden craft, warm bokeh background. PORTRAIT 2:3.
7. BACKGROUND TEXTURE - Warm dark wood grain texture or workshop interior (very dark, 80%+ overlay will cover it). WIDE.

KNOWN WORKING IDs IN THIS PROJECT:
- 3637785 = carpentry sawdust/tools close-up ✅
- 4792494 = drill and toolbox ✅
- BAD IDs to avoid: 3637786 (industrial factory), 5582591 (person at laptop), 4503273 (plant pots), 1251175 (renders dark)

Please respond with a JSON object listing your photo recommendations:
{
  "bridge_hero": { "reasoning": "...", "pexels_search_url": "https://www.pexels.com/search/...", "candidate_ids": [id1, id2, id3] },
  "before_photo": { ... },
  "after_photo": { ... },
  "pin_1": { ... },
  "pin_2": { ... },
  "pin_3": { ... },
  "background_texture": { ... }
}

For candidate_ids: provide real Pexels photo IDs you are confident about from your training data, OR ranges like "3637700-3637800" if you know woodworking photos are in that range.`

  let mistralResponse = ''
  try {
    mistralResponse = await askMistral(mistralPrompt)
    console.log('Mistral response:\n')
    console.log(mistralResponse)
    fs.writeFileSync(path.join(outDir, 'mistral-response.txt'), mistralResponse)
  } catch (e) {
    console.error('Mistral API error:', e.message)
    mistralResponse = '{}'
  }

  // ── Extract any IDs Mistral suggested ─────────────────────────────────────
  const suggestedIds = new Set()
  const idMatches = mistralResponse.match(/\b\d{5,8}\b/g) || []
  idMatches.forEach(id => {
    const n = parseInt(id)
    if (n >= 10000 && n <= 50000000) suggestedIds.add(n)
  })
  console.log(`\nMistral suggested ${suggestedIds.size} potential IDs: ${[...suggestedIds].join(', ')}`)

  // ── Probe strategic ID ranges (near known woodworking photos) ─────────────
  console.log('\nStep 2: Probing Pexels CDN for valid woodworking photo IDs...\n')

  // Range A: Around the known good woodworking IDs (3637785)
  console.log('Range A: 3637700-3638000 (near known woodworking photos)...')
  const rangeA = await probeRange(3637700, 3638000, 1)
  
  // Range B: 5503000-5503200 (popular free woodworking photos era)
  console.log('Range B: 5503000-5503200...')
  const rangeB = await probeRange(5503000, 5503200, 2)
  
  // Range C: 1792000-1792300 (craftsman/workshop era)
  console.log('Range C: 1792000-1792200...')
  const rangeC = await probeRange(1792000, 1792200, 2)

  // Range D: 3913000-3913200 (woodworking project photos)
  console.log('Range D: 3913000-3913200...')
  const rangeD = await probeRange(3913000, 3913200, 2)

  // Range E: Check Mistral-suggested IDs specifically
  const mistralCandidates = [...suggestedIds].slice(0, 50)
  console.log(`Range E: Testing ${mistralCandidates.length} Mistral-suggested IDs...`)
  const rangeE = await Promise.all(mistralCandidates.map(id => checkPexelsId(id)))
  const validE = rangeE.filter(r => r.ok && r.size > 10000)
  process.stdout.write('\n')

  const allValid = [...rangeA, ...rangeB, ...rangeC, ...rangeD, ...validE]
  console.log(`\nFound ${allValid.length} valid photo IDs. Downloading thumbnails...`)

  // ── Download thumbnails ─────────────────────────────────────────────────
  const downloaded = []
  for (const result of allValid.slice(0, 60)) {
    try {
      const p = await downloadThumb(result.id, outDir)
      downloaded.push({ id: result.id, path: p, size: result.size })
      process.stdout.write('↓')
    } catch (e) {
      process.stdout.write('✗')
    }
  }
  process.stdout.write('\n')

  // ── Generate HTML review page ──────────────────────────────────────────
  const thumbsHtml = downloaded.map(d => `
    <div class="thumb">
      <img src="${d.path}" loading="lazy" onclick="select(${d.id})" title="ID: ${d.id}">
      <div class="label">${d.id}<br><small>${Math.round(d.size/1024)}KB</small></div>
    </div>`).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
<title>Woodworking Photo Candidates</title>
<style>
body { background:#111; color:#eee; font-family:monospace; margin:20px }
.grid { display:flex; flex-wrap:wrap; gap:10px }
.thumb { width:200px; text-align:center; cursor:pointer; border:3px solid transparent; padding:4px; border-radius:6px }
.thumb:hover { border-color:#f90 }
.thumb img { width:192px; height:128px; object-fit:cover; border-radius:4px }
.label { font-size:12px; color:#9cf; margin-top:4px }
#selected { background:#1a1a2e; border:1px solid #444; padding:16px; margin-bottom:20px; font-size:14px }
</style>
</head>
<body>
<h1>Woodworking Photo Candidates</h1>
<div id="selected">Click a photo to see its ID. IDs found: ${downloaded.length}</div>
<div class="grid">${thumbsHtml}</div>
<script>
function select(id) {
  document.getElementById('selected').innerHTML = 
    '<b>Selected ID: ' + id + '</b> — Pexels URL: https://images.pexels.com/photos/' + id + '/pexels-photo-' + id + '.jpeg?auto=compress&cs=tinysrgb&w=1200';
  navigator.clipboard?.writeText(String(id));
}
</script>
</body>
</html>`

  const reviewPath = path.join(outDir, 'review.html')
  fs.writeFileSync(reviewPath, html)
  console.log(`\nReview page: ${reviewPath}`)
  console.log(`Thumbnails saved to: ${outDir}`)
  
  // ── Print all valid IDs for quick use ──────────────────────────────────
  console.log('\n═══ ALL VALID PHOTO IDs ═══')
  downloaded.forEach(d => console.log(`  ${d.id}  (${Math.round(d.size/1024)}KB) — file://${d.path}`))
  
  // ── Save JSON report ───────────────────────────────────────────────────
  const report = {
    timestamp: new Date().toISOString(),
    model_used: OPENROUTER_MODEL,
    mistral_suggested_ids: [...suggestedIds],
    valid_ids_found: downloaded.map(d => ({ id: d.id, size_kb: Math.round(d.size/1024) })),
    review_html: reviewPath
  }
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2))
  console.log('\nReport saved to tmp/photo-candidates/report.json')
}

main().catch(console.error)
