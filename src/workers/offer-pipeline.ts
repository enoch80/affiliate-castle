/**
 * Offer Pipeline Worker
 * BullMQ worker that processes each hoplink submission:
 * 1. Resolve affiliate hoplink → final landing page URL
 * 2. Scrape landing page (Playwright + fetch fallback)
 * 3. LLM extraction of product details
 * 4. Persist all data to DB (Offer + MarketResearch records)
 * 5. Update Campaign status to 'researched'
 * 6. [Sprint 3] Scrape Bing SERP top 10 for primary keyword
 * 7. [Sprint 3] Run semantic gap analysis
 * 8. [Sprint 3] Generate content brief JSON
 * 9. [Sprint 3] Update Campaign status to 'brief_ready'
 * 10. [Sprint 4] Generate all 12 content types using brief + offer data
 * 11. [Sprint 4] Humanize each piece (burstiness + phrase replacement)
 * 12. [Sprint 4] Score each piece for AI detection (target <15%)
 * 13. [Sprint 4] Persist all ContentPieces + update Campaign to 'content_ready'
 */

import { Worker, Job } from 'bullmq'
import IORedis from 'ioredis'
import { prisma } from '../lib/prisma'
import { resolveHoplink } from '../lib/link-resolver'
import { scrapeOfferPage } from '../lib/offer-scraper'
import { extractOfferDetails } from '../lib/llm-extractor'
import { scrapeSerpTop10 } from '../lib/serp-scraper'
import { analyzeSemanticGap } from '../lib/semantic-gap'
import { generateContentBrief } from '../lib/content-brief'
import { generateAllContent } from '../lib/content-generator'
import { humanize } from '../lib/humanizer'
import { scoreContent } from '../lib/ai-detector'
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

  // Create keyword research record (Sprint 2 data only at this point)
  const keywordRecord = await prisma.keywordResearch.create({
    data: {
      offerId,
      primaryKeyword: extraction.primaryKeyword,
      secondaryKeywords: extraction.secondaryKeywords,
    },
  })

  // Step 5: Update Campaign status to 'researched'
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: 'researched',
      angle: extraction.angle,
      name: extraction.productName,
    },
  })

  // ─── Sprint 3: SERP scraping + semantic gap + content brief ────────────────
  await job.updateProgress(85)
  const keyword = extraction.primaryKeyword || extraction.productName || 'affiliate offer'

  let serpResults: import('../lib/serp-scraper').SerpResult[] = []
  try {
    serpResults = await scrapeSerpTop10(keyword)
    console.log(`[offer-pipeline] Sprint 3: scraped ${serpResults.length} SERP results`)
  } catch (err) {
    console.error('[offer-pipeline] Sprint 3 SERP scrape failed (non-fatal):', err)
    serpResults = []
  }

  // Semantic gap analysis
  const gapAnalysis = analyzeSemanticGap(keyword, serpResults)
  console.log(`[offer-pipeline] Sprint 3: gap analysis — target ${gapAnalysis.targetWordCount} words, ${gapAnalysis.mandatoryEntities.length} mandatory entities`)

  // Content brief generation
  const brief = generateContentBrief({
    campaignId,
    primaryKeyword: keyword,
    secondaryKeywords: (extraction.secondaryKeywords as string[]) || [],
    angle: extraction.angle || '',
    targetAudience: (extraction.targetAudience as string[]) || [],
    painPoints: (extraction.painPoints as string[]) || [],
    benefits: (extraction.benefits as string[]) || [],
    productName: extraction.productName || '',
    hoplink,
    gap: gapAnalysis,
  })

  // Persist SERP data + brief into KeywordResearch record
  await prisma.keywordResearch.update({
    where: { id: keywordRecord.id },
    data: {
      serpTop10: serpResults as unknown as object[],
      semanticGap: gapAnalysis as unknown as object,
      avgWordCount: gapAnalysis.avgWordCount,
      targetWordCount: gapAnalysis.targetWordCount,
    },
  })

  // Store content brief in the ContentPiece table (type = 'content_brief')
  await prisma.contentPiece.create({
    data: {
      campaignId,
      type: 'content_brief',
      contentText: JSON.stringify(brief, null, 2),
      serpBriefJson: brief as unknown as object,
      status: 'ready',
    },
  })

  // Update offer status to reflect brief is ready
  await prisma.offer.update({
    where: { id: offerId },
    data: { status: 'brief_ready' },
  })

  // Update campaign status to 'brief_ready'
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'brief_ready' },
  })

  // ─── Sprint 4: Generate 12 content types, humanize, score ──────────────────
  await job.updateProgress(88)
  console.log(`[offer-pipeline] Sprint 4: generating 12 content pieces for campaign ${campaignId}`)

  // Step 10: Generate all 12 content types
  let generatedPieces: import('../lib/content-generator').GeneratedContent[] = []
  try {
    generatedPieces = await generateAllContent(brief)
    console.log(`[offer-pipeline] Sprint 4: generated ${generatedPieces.length} content pieces`)
  } catch (err) {
    console.error('[offer-pipeline] Sprint 4 content generation failed (non-fatal):', err)
  }

  // Steps 11–13: Humanize each piece, score, persist
  const contentPieceIds: string[] = []
  for (const piece of generatedPieces) {
    // Step 11: Humanize
    const humanizationResult = humanize(piece.contentText, piece.type)

    // Step 12: Score for AI detection
    const detection = scoreContent(humanizationResult.humanized)
    console.log(`[offer-pipeline] Sprint 4: ${piece.type} → AI score ${detection.score.toFixed(1)}% (passes: ${detection.passesThreshold})`)

    // Step 13: Persist ContentPiece
    const saved = await prisma.contentPiece.create({
      data: {
        campaignId,
        type: piece.type,
        contentText: humanizationResult.humanized,
        contentHtml: piece.contentHtml,
        detectionScore: detection.score,
        status: detection.passesThreshold ? 'ready' : 'needs_revision',
      },
    })
    contentPieceIds.push(saved.id)
  }

  const passingCount = generatedPieces.length > 0
    ? (await prisma.contentPiece.findMany({
        where: { campaignId, status: 'ready', NOT: { type: 'content_brief' } },
      })).length
    : 0

  console.log(`[offer-pipeline] Sprint 4: ${passingCount}/${generatedPieces.length} pieces passed AI detection`)

  // Advance campaign to content_ready regardless of detection score
  // (pieces flagged 'needs_revision' can be re-generated from the dashboard)
  await prisma.offer.update({
    where: { id: offerId },
    data: { status: 'content_ready' },
  })

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'content_ready' },
  })

  await job.updateProgress(100)
  console.log(`[offer-pipeline] Job ${job.id} complete — campaign ${campaignId} is content_ready`)

  return {
    offerId,
    campaignId,
    productName: extraction.productName,
    briefReady: true,
    contentReady: true,
    piecesGenerated: generatedPieces.length,
    passingDetection: passingCount,
  }
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
