/**
 * Tests specific known woodworking Pexels IDs and downloads thumbnails for visual review.
 * Uses curated IDs from LLM knowledge of popular woodworking Pexels photos.
 */
import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function checkAndDownload(id) {
  const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=400`
  const outPath = path.join(__dirname, 'tmp', 'woodworking-candidates', `${id}.jpg`)
  
  return new Promise((resolve) => {
    const file = fs.createWriteStream(outPath)
    const req = https.get(url, { timeout: 8000 }, (res) => {
      if (res.statusCode !== 200) {
        file.close()
        try { fs.unlinkSync(outPath) } catch {}
        resolve({ id, ok: false, status: res.statusCode })
        return
      }
      let size = 0
      res.on('data', chunk => size += chunk.length)
      res.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve({ id, ok: true, size })
      })
    })
    req.on('error', () => {
      file.close()
      try { fs.unlinkSync(outPath) } catch {}
      resolve({ id, ok: false, status: 0 })
    })
    req.on('timeout', () => {
      req.destroy()
      file.close()
      try { fs.unlinkSync(outPath) } catch {}
      resolve({ id, ok: false, status: 'timeout' })
    })
  })
}

async function main() {
  const outDir = path.join(__dirname, 'tmp', 'woodworking-candidates')
  fs.mkdirSync(outDir, { recursive: true })

  // Curated list of Pexels IDs that are known/likely to be woodworking photos
  // Based on LLM training knowledge of popular Pexels woodworking content
  const candidateIds = [
    // Classic woodworking/workshop photos (well-known popular ones)
    1251175,  // tools on workbench (we know this one but it's dark)
    3637785,  // carpentry/sawdust ✅ already confirmed
    4792494,  // drill+toolbox ✅ already confirmed
    
    // Workshop/carpentry photos from popular era (2017-2021 uploads)
    1458241,  // woodworking tools/workbench
    1552103,  // carpentry
    1579821,  // workshop 
    1616779,  // builder/woodworker
    1680152,  // tools/drill
    1571442,  // workshop
    2249959,  // woodworking plans/blueprints
    2253435,  // sawing wood
    2343465,  // wood cutting
    2695980,  // workshop interior
    2822680,  // wood carving
    2860790,  // carpentry tools
    2882558,  // woodworking
    3039211,  // workshop
    3256300,  // wood workshop
    3329571,  // woodworking project
    3342125,  // tools
    3404285,  // workshop
    3491891,  // woodworking
    3526474,  // wood crafts
    3555627,  // carpentry
    3622193,  // workshop
    3622194,  // tools on bench
    3622195,  // woodworking
    3684307,  // workshop
    3769117,  // wood
    3822899,  // carpenter
    3825517,  // woodworking
    3825581,  // workshop interior  
    3862419,  // tools
    4148946,  // woodworking
    4219860,  // workshop
    4220440,  // carpenter
    4348001,  // woodworking tools
    4348021,  // workshop
    4426270,  // carpenter working
    4429260,  // wood project
    4481581,  // woodworking tools
    4481823,  // carpentry
    4483093,  // workshop layout
    4483096,  // tools
    4483100,  // woodworking
    4484108,  // workshop
    4512419,  // carpenter
    4514951,  // wood project
    4516890,  // woodworking
    4590063,  // workshop
    4917427,  // workshop tools
    5006789,  // carpentry
    5093704,  // woodworking
    5257134,  // tools on workbench
    5257143,  // workshop
    5298843,  // carpenter
    5299171,  // woodworking
    5299175,  // tools
    5407238,  // workshop bench
    5485045,  // woodworking
    5503011,  // carpentry
    5503043,  // woodworking project
    5503055,  // workshop
    5503067,  // tools
    5503079,  // wood crafts
    5503091,  // workshop
    5503103,  // woodworking
    5503115,  // carpenter
    5691680,  // woodworking plans/blueprints
    5691681,  // workshop plans
    6256254,  // woodworking
    6256825,  // carpentry
    6256841,  // workshop
    6257039,  // worker/wood
    6461337,  // tools
    6543879,  // workshop
    6543881,  // woodworking
    6543897,  // tools bench
    7005377,  // workbench
    7005389,  // carpenter
    7241393,  // woodworking hobby
    7368858,  // DIY woodworking
    8001015,  // workshop
    8069210,  // woodworking
    
    // Portrait-oriented woodworking (for Pinterest pins)
    3622193,  // woodworker portrait
    4426270,  // person woodworking
    3329571,  // hands on project
    5691680,  // plans portrait
    8863572,  // woodworker hands
    5765829,  // craftsman hands
    4348001,  // tools portrait
    
    // "finished project" type photos
    6543879,  // finished furniture
    2695980,  // finished wood piece
    3822899,  // holding finished project
    
    // Dark wood texture / workshop ambient (for backgrounds)
    1068523,  // dark wood texture
    1172253,  // dark workshop
    1410226,  // wood grain dark
    675920,   // dark wood
    1148953,  // wood texture dark
  ]

  console.log(`Testing ${candidateIds.length} candidate IDs...`)
  
  const results = []
  for (let i = 0; i < candidateIds.length; i += 10) {
    const batch = candidateIds.slice(i, i + 10)
    const batchResults = await Promise.all(batch.map(id => checkAndDownload(id)))
    results.push(...batchResults)
    const ok = batchResults.filter(r => r.ok).length
    process.stdout.write(`[${i+10}/${candidateIds.length}] ${ok} ok\n`)
  }

  const valid = results.filter(r => r.ok && r.size > 8000)
  console.log(`\n✅ Valid photos: ${valid.length}`)
  valid.forEach(r => console.log(`  ${r.id} (${Math.round(r.size/1024)}KB) → file://${outDir}/${r.id}.jpg`))
}

main().catch(console.error)
