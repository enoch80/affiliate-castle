/**
 * Offer Pipeline Worker
 * BullMQ worker that processes each hoplink submission:
 * 1. Resolve affiliate hoplink → final landing page URL
 * 2. Scrape landing page (Playwright + fetch fallback)
 * 3. LLM extraction of product details
 * 4. Persist all data to DB (Offer + MarketResearch records)
 * 5. Update Campaign status to 'researched'
 */

import { Worker, Job } from 'bullmq'
import IORedis from 'ioredis'
import { prisma } from '../lib/prisma'
import { resolveHoplink } from '../lib/link-resolver'
import { scrapeOfferPage } from '../lib/offer-scraper'
import { extractOfferDetails } from '../lib/llm-extractor'
import type { OfferPipelineJobData } from '../lib/queue'

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379'

function parseRedisUrl(url: string) {
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    db: parseInt(parsed.pathname.slice(1) || '0', 10),
  }
}

const connection = new IORedis({
  ...parseRedisUrl(REDIS_URL),
  maxRetriesPerRequest: null, // Required by BullMQ
})

async function processOfferJob(job: Job<OfferPipelineJobData>) {
  const { offerId, campaignId, hoplink } = job.data
  console.log(`[offer-pipeline] Processing job ${job.id} — offer ${offerId}`)

  // Step 1: Resolve the hoplink
  await job.updateProgress(10)
  let finalUrl = hoplink
  let network = 'unknown'

  try {
    const resolved = await resolveHoplink(hoplink)
    finalUrl = resolved.finalUrl
    network = resolved.network

    await prisma.offer.update({
      where: { id: offerId },
      data: { resolvedUrl: finalUrl, network, status: 'resolved' },
    })
    console.log(`[offer-pipeline] Resolved ${hoplink} → ${finalUrl} (${network})`)
  } catch (err) {
    console.warn(`[offer-pipeline] Link resolve failed, using raw hoplink:`, err)
  }

  // Step 2: Scrape the landing page
  await job.updateProgress(30)
  let scrapedPage
  try {
    scrapedPage = await scrapeOfferPage(finalUrl)
    await prisma.offer.update({
      where: { id: offerId },
      data: {
        landingPageHtml: scrapedPage.html.slice(0, 500000), // cap at 500KB
        status: 'scraped',
      },
    })
    console.log(`[offer-pipeline] Scraped ${finalUrl} — ${scrapedPage.bodyText.length} chars`)
  } catch (err) {
    console.error(`[offer-pipeline] Scrape failed:`, err)
    await prisma.offer.update({ where: { id: offerId }, data: { status: 'scrape_failed' } })
    throw err // let BullMQ retry
  }

  // Step 3: LLM extraction
  await job.updateProgress(60)
  let extraction
  try {
    extraction = await extractOfferDetails(scrapedPage)
    console.log(`[offer-pipeline] Extracted: ${extraction.productName} (${extraction.niche}) conf=${extraction.confidence}`)
  } catch (err) {
    console.error(`[offer-pipeline] LLM extraction failed:`, err)
    await prisma.offer.update({ where: { id: offerId }, data: { status: 'extraction_failed' } })
    throw err
  }

  // Step 4: Persist Offer + MarketResearch
  await job.updateProgress(80)
  await prisma.offer.update({
    where: { id: offerId },
    data: {
      productName: extraction.productName,
      niche: extraction.niche,
      pricePoint: extraction.pricePoint,
      commissionPct: extraction.commissionPct,
      commissionFixed: extraction.commissionFixed,
      status: 'researched',
    },
  })

  await prisma.marketResearch.upsert({
    where: { offerId },
    create: {
      offerId,
      targetAudience: extraction.targetAudience,
      painPoints: extraction.painPoints,
      benefits: extraction.benefits,
      trustSignals: extraction.trustSignals,
    },
    update: {
      targetAudience: extraction.targetAudience,
      painPoints: extraction.painPoints,
      benefits: extraction.benefits,
      trustSignals: extraction.trustSignals,
    },
  })

  // Create keyword research record
  await prisma.keywordResearch.create({
    data: {
      offerId,
      primaryKeyword: extraction.primaryKeyword,
      secondaryKeywords: extraction.secondaryKeywords,
    },
  })

  // Step 5: Update Campaign status
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: 'researched',
      angle: extraction.angle,
      name: extraction.productName,
    },
  })

  await job.updateProgress(100)
  console.log(`[offer-pipeline] Job ${job.id} complete — campaign ${campaignId} is researched`)

  return { offerId, campaignId, productName: extraction.productName }
}

// Start the worker
const worker = new Worker<OfferPipelineJobData>('offer-pipeline', processOfferJob, {
  connection,
  concurrency: 2,
  limiter: {
    max: 5,
    duration: 60000, // 5 jobs per minute (rate limit for scraping)
  },
})

worker.on('completed', (job) => {
  console.log(`[offer-pipeline] ✅ Job ${job.id} completed`, job.returnvalue)
})

worker.on('failed', (job, err) => {
  console.error(`[offer-pipeline] ❌ Job ${job?.id} failed:`, err.message)
})

worker.on('error', (err) => {
  console.error('[offer-pipeline] Worker error:', err)
})

console.log('[offer-pipeline] Worker started, listening on queue: offer-pipeline')

export default worker
