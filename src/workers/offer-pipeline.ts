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
import { extractOfferDetails, CANONICAL_NICHES, type CanonicalNiche } from '../lib/llm-extractor'
import { scrapeSerpTop10 } from '../lib/serp-scraper'
import { analyzeSemanticGap } from '../lib/semantic-gap'
import { generateContentBrief } from '../lib/content-brief'
import { expandKeywords, scoreKeywordsByKgr, pickBestKeyword } from '../lib/kgr'
import { generateAllContent } from '../lib/content-generator'
import { humanize } from '../lib/humanizer'
import { scoreContent } from '../lib/ai-detector'
import { renderPDF } from '../lib/pdf-generator'
import { renderBridgePages } from '../lib/bridge-renderer'
import { createTrackingLinks } from '../lib/tracking'
import { publishCampaign } from '../lib/publisher/index'
import { scheduleTelegramSeries } from '../lib/telegram-scheduler'
import { scheduleDripSequence } from '../lib/drip-scheduler'
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

  // Step 3b: Niche normalization — map LLM output to canonical niche set
  const NICHE_SLUG_MAP: Record<string, string> = {
    woodworking: 'woodworking', carpentry: 'woodworking',
    gardening: 'gardening', garden: 'gardening',
    fishing: 'fishing', angling: 'fishing',
    quilting: 'quilting', sewing: 'quilting',
    birding: 'birding', 'bird-watching': 'birding', 'bird_watching': 'birding',
    genealogy: 'genealogy',
    'ham-radio': 'ham-radio', 'amateur-radio': 'ham-radio', 'ham_radio': 'ham-radio',
    'rv-living': 'rv-living', rv: 'rv-living',
    watercolor: 'watercolor', painting: 'watercolor',
    canning: 'canning', preserving: 'canning',
    'model-railroading': 'model-railroading', 'model_railroading': 'model-railroading',
    health: 'health', wealth: 'wealth', relationships: 'relationships',
    software: 'software', survival: 'survival',
  }
  const rawNiche = (extraction.niche || '').toLowerCase().replace(/[^a-z_-]/g, '-')
  const canonicalNiche = NICHE_SLUG_MAP[rawNiche] ||
    ((CANONICAL_NICHES as readonly string[]).includes(rawNiche) ? rawNiche as CanonicalNiche : 'general')
  extraction.niche = canonicalNiche as CanonicalNiche

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
      nicheSlug: canonicalNiche,
    },
  })

  // ─── Sprint 3: SERP scraping + semantic gap + content brief ────────────────
  await job.updateProgress(85)
  const seedKeyword = extraction.primaryKeyword || extraction.productName || 'affiliate offer'

  // ─── Step 3.5: KGR keyword selection (Bing autocomplete + competition scoring) ───
  await job.updateProgress(32)
  let keyword = seedKeyword
  let kgrResultBest: import('../lib/kgr').KgrResult | null = null
  let kgrScoredAll: import('../lib/kgr').KgrResult[] = []

  try {
    console.log(`[offer-pipeline] Step 3.5: expanding keywords for seed "${seedKeyword}"`)
    const { expanded, searchIntent } = await expandKeywords(seedKeyword, canonicalNiche)
    console.log(`[offer-pipeline] Step 3.5: expanded to ${expanded.length} candidates`)

    if (expanded.length > 0) {
      kgrScoredAll = await scoreKeywordsByKgr(expanded, 2, 'authority')
      kgrResultBest = pickBestKeyword(kgrScoredAll, 'authority')
      keyword = kgrResultBest.keyword

      // Store search intent on keyword research record
      await prisma.keywordResearch.update({
        where: { id: keywordRecord.id },
        data: {
          primaryKeyword: keyword,
          searchIntent,
          kgrScore: kgrResultBest.kgr,
          kgrTier: kgrResultBest.tier,
          allintitleCount: kgrResultBest.allintitleCount,
          estimatedVolume: kgrResultBest.estimatedVolume,
          kgrCandidates: kgrScoredAll as unknown as object[],
        },
      })

      console.log(
        `[offer-pipeline] Step 3.5: KGR selected "${keyword}" ` +
        `(${kgrResultBest.tier}, KGR=${kgrResultBest.kgr.toFixed(2)}, vol≈${kgrResultBest.estimatedVolume}, halo≈${kgrResultBest.estimatedHaloVolume})`,
      )
      console.log(
        '[offer-pipeline] KGR scores: ' +
        kgrScoredAll.map(r => `${r.keyword} → ${r.kgr.toFixed(2)} (${r.tier})`).join(' | '),
      )
    }
  } catch (err) {
    console.error('[offer-pipeline] Step 3.5 KGR selection failed (non-fatal, using seed keyword):', err)
  }

  let serpResults: import('../lib/serp-scraper').SerpResult[] = []
  let serpPageData: import('../lib/serp-scraper').SerpPageData = { paaQuestions: [], relatedSearches: [] }
  try {
    const scraped = await scrapeSerpTop10(keyword)
    serpResults = scraped.results
    serpPageData = scraped.serpPageData
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
      paaQuestions: serpPageData.paaQuestions as unknown as object[],
      relatedSearches: serpPageData.relatedSearches as unknown as object[],
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
  const offerContext = {
    productName: extraction.productName || '',
    niche: extraction.niche || '',
    angle: extraction.angle || '',
    targetAudience: (extraction.targetAudience as string[]) || [],
    painPoints: (extraction.painPoints as string[]) || [],
    benefits: (extraction.benefits as string[]) || [],
    trustSignals: (extraction.trustSignals as string[]) || [],
    hoplink,
    primaryKeyword: keyword,
    secondaryKeywords: (extraction.secondaryKeywords as string[]) || [],
  }

  let generatedPieces: import('../lib/content-generator').GeneratedContent[] = []
  try {
    generatedPieces = await generateAllContent(brief, offerContext)
    console.log(`[offer-pipeline] Sprint 4: generated ${generatedPieces.length} content pieces`)
  } catch (err) {
    console.error('[offer-pipeline] Sprint 4 content generation failed (non-fatal):', err)
  }

  // Steps 11–13: Humanize each piece, score, persist
  const contentPieceIds: string[] = []
  for (const piece of generatedPieces) {
    // Step 11: Humanize
    const humanizationResult = humanize(piece.text, piece.type)

    // Step 12: Score for AI detection
    const detection = scoreContent(humanizationResult.humanized)
    console.log(`[offer-pipeline] Sprint 4: ${piece.type} → AI score ${detection.score.toFixed(1)}% (passes: ${detection.passesThreshold})`)

    // Step 13: Persist ContentPiece
    const saved = await prisma.contentPiece.create({
      data: {
        campaignId,
        type: piece.type,
        contentText: humanizationResult.humanized,
        contentHtml: piece.html,
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

  // ─── Sprint 5: PDF generation + bridge pages ───────────────────────────
  await job.updateProgress(92)
  console.log(`[offer-pipeline] Sprint 5: generating lead magnet PDF + bridge pages for campaign ${campaignId}`)

  let leadMagnetId: string | null = null
  let leadMagnetUrl = ''

  // Step 14: Render lead_magnet ContentPiece HTML → PDF
  try {
    const leadMagnetPiece = await prisma.contentPiece.findFirst({
      where: { campaignId, type: 'lead_magnet' },
    })

    if (leadMagnetPiece?.contentHtml || leadMagnetPiece?.contentText) {
      const html = leadMagnetPiece.contentHtml || leadMagnetPiece.contentText || ''
      const slug = `lead-magnet-${Date.now()}`
      const pdfResult = await renderPDF(html, campaignId, slug)
      console.log(`[offer-pipeline] Sprint 5: PDF rendered → ${pdfResult.publicUrl} (${pdfResult.sizeBytes} bytes)`)

      const savedMagnet = await prisma.leadMagnet.create({
        data: {
          campaignId,
          title: `${extraction.productName || keyword} — Free Guide`,
          type: 'guide',
          contentHtml: html,
          pdfPath: pdfResult.pdfPath,
        },
      })
      leadMagnetId = savedMagnet.id
      leadMagnetUrl = pdfResult.publicUrl
    }
  } catch (err) {
    console.error('[offer-pipeline] Sprint 5 PDF generation failed (non-fatal):', err)
  }

  // Step 15: Render bridge page A/B variants
  let bridgeSlugA = ''
  let bridgeSlugB = ''
  try {
    // Extract headline variants from ContentPiece types
    const bridgePieceA = await prisma.contentPiece.findFirst({
      where: { campaignId, type: 'bridge_headline_a' },
    })
    const bridgePieceB = await prisma.contentPiece.findFirst({
      where: { campaignId, type: 'bridge_headline_b' },
    })
    const bridgePage = await prisma.contentPiece.findFirst({
      where: { campaignId, type: 'bridge_page' },
    })

    const headlineA = bridgePieceA?.contentText?.trim() ||
      `${extraction.productName}: The ${keyword} Solution You've Been Waiting For`
    const headlineB = bridgePieceB?.contentText?.trim() ||
      `Why ${extraction.productName} Is the Best Way to ${keyword}`

    // Parse FAQ block from faq_block ContentPiece if available
    let faqItems: Array<{ question: string; answer: string }> = []
    const faqPiece = await prisma.contentPiece.findFirst({
      where: { campaignId, type: 'faq_block' },
    })
    if (faqPiece?.contentText) {
      try {
        const parsed = JSON.parse(faqPiece.contentText)
        if (Array.isArray(parsed)) faqItems = parsed
      } catch { /* use default */ }
    }

    const bridgeResult = await renderBridgePages({
      campaignId,
      productName: extraction.productName || keyword,
      niche: extraction.niche || 'general',
      primaryKeyword: keyword,
      hoplink,
      headlineA,
      headlineB,
      subHeadline: extraction.angle || `Discover the proven approach to ${keyword}`,
      angle: extraction.angle || '',
      benefits: (extraction.benefits as string[]) || [],
      painPoints: (extraction.painPoints as string[]) || [],
      trustSignals: (extraction.trustSignals as string[]) || [],
      faqItems,
      leadMagnetTitle: `${keyword} — Complete Guide`,
      leadMagnetUrl: leadMagnetUrl || `/magnets/${campaignId}/guide.pdf`,
      leadMagnetId,
    })

    bridgeSlugA = bridgeResult.variantA.slug
    bridgeSlugB = bridgeResult.variantB.slug
    console.log(`[offer-pipeline] Sprint 5: bridge pages created — A=/go/${bridgeSlugA} B=/go/${bridgeSlugB}`)
  } catch (err) {
    console.error('[offer-pipeline] Sprint 5 bridge render failed (non-fatal):', err)
  }

  // Step 16: Advance campaign to bridge_ready
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'bridge_ready' },
  })

  // -------------------------------------------------------------------------
  // Sprint 6 — Step 17: Create per-platform tracking links
  // -------------------------------------------------------------------------
  let trackingLinks: Awaited<ReturnType<typeof createTrackingLinks>>['links'] = []
  try {
    const trackingResult = await createTrackingLinks(
      { campaignId, hoplink },
      process.env.APP_BASE_URL ?? 'http://localhost:3200'
    )
    trackingLinks = trackingResult.links
    console.log(`[offer-pipeline] Sprint 6 — ${trackingLinks.length} tracking links created`)
  } catch (err) {
    console.error('[offer-pipeline] Sprint 6 tracking links failed (non-fatal):', err)
  }

  await job.updateProgress(100)
  console.log(`[offer-pipeline] Job ${job.id} complete — campaign ${campaignId} is bridge_ready`)

  // -------------------------------------------------------------------------
  // Sprint 7 — Steps 18–20: Publish to 4 platforms, IndexNow, sitemap
  // -------------------------------------------------------------------------
  // Publishing runs AFTER the job reports progress=100 so the UI shows
  // bridge_ready immediately. The worker continues in background.
  const baseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3200'
  const bridgePageUrl = bridgeSlugA
    ? `${baseUrl}/go/${bridgeSlugA}`
    : baseUrl

  try {
    const publishResult = await publishCampaign({
      campaignId,
      campaignName: extraction.productName || keyword,
      niche: extraction.niche || 'general',
      primaryKeyword: keyword,
      bridgePageUrl,
    })

    const publishedCount = publishResult.results.filter((r) => r.success).length
    console.log(`[offer-pipeline] Sprint 7 — published to ${publishedCount}/4 platforms`)

    // Advance to publishing or indexed depending on how many platforms succeeded
    if (publishedCount > 0) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: publishResult.indexNowSubmitted ? 'indexed' : 'publishing' },
      })
    }
  } catch (err) {
    console.error('[offer-pipeline] Sprint 7 publish failed (non-fatal):', err)
  }

  // -------------------------------------------------------------------------
  // Sprint 8 — Step 21: Schedule Telegram 10-post series (if channel exists)
  // -------------------------------------------------------------------------
  // Automatically picks the first active TelegramChannel registered in the app.
  // Non-fatal: if no channel exists, or scheduling fails, pipeline still succeeds.
  let telegramPostsQueued = 0
  try {
    const defaultChannel = await prisma.telegramChannel.findFirst({
      where: { isActive: true },
      select: { id: true, channelUsername: true, channelId: true },
      orderBy: { createdAt: 'asc' },
    })

    if (defaultChannel) {
      const tgResult = await scheduleTelegramSeries({
        campaignId,
        channelId: defaultChannel.id,
        channelTgId: defaultChannel.channelId ?? defaultChannel.channelUsername,
        campaignName: extraction.productName || keyword,
        niche: extraction.niche || 'general',
        primaryKeyword: keyword,
        bridgePageUrl,
      })
      telegramPostsQueued = tgResult.postsQueued
      console.log(`[offer-pipeline] Sprint 8 — queued ${telegramPostsQueued} Telegram posts`)

      // Advance campaign to 'live' once Telegram series is fully queued
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'live' },
      })
    } else {
      console.log('[offer-pipeline] Sprint 8 — no active TelegramChannel found, skipping Telegram schedule')
    }
  } catch (err) {
    console.error('[offer-pipeline] Sprint 8 Telegram schedule failed (non-fatal):', err)
  }

  // -------------------------------------------------------------------------
  // Sprint 9 — Step 22: Schedule email drip for test opt-in lead (if configured)
  // -------------------------------------------------------------------------
  // In production this is triggered per opt-in via the bridge page form handler.
  // Here we seed a test drip schedule using PIPELINE_TEST_EMAIL env var (if set)
  // so the full sequence is created and can be validated end-to-end.
  let emailSequenceId: string | null = null
  const testEmail = process.env.PIPELINE_TEST_EMAIL
  if (testEmail) {
    try {
      const dripResult = await scheduleDripSequence({
        campaignId,
        subscriberEmail: testEmail,
        subscriberFirstName: 'Tester',
        campaignName: extraction.productName || keyword,
        niche: extraction.niche || 'general',
        primaryKeyword: keyword,
        bridgePageUrl,
        leadMagnetUrl: leadMagnetUrl ?? null,
        senderName: process.env.EMAIL_SENDER_NAME ?? 'Your Guide',
        physicalAddress: process.env.EMAIL_PHYSICAL_ADDRESS ?? '123 Main St, Anytown, USA',
        unsubscribeUrl: '{{unsubscribe_url}}',
      })
      emailSequenceId = dripResult.sequenceId
      console.log(`[offer-pipeline] Sprint 9 — email drip queued: ${dripResult.stepsCreated} steps (${dripResult.stepsBlocked} blocked)`)
    } catch (err) {
      console.error('[offer-pipeline] Sprint 9 email drip failed (non-fatal):', err)
    }
  }

  return {
    offerId,
    campaignId,
    productName: extraction.productName,
    briefReady: true,
    contentReady: true,
    bridgeReady: true,
    piecesGenerated: generatedPieces.length,
    passingDetection: passingCount,
    leadMagnetUrl,
    bridgeSlugA,
    bridgeSlugB,
    trackingLinksCreated: trackingLinks.length,
    telegramPostsQueued,
    emailSequenceId,
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
