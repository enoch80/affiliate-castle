/**
 * Sprint 7 — Multi-platform publishing orchestrator
 *
 * Publishes all platform content pieces for a campaign:
 *   dev.to, Hashnode, Blogger, Tumblr (with staggered delays)
 * Then:
 *   - IndexNow ping (Bing + Yandex + Seznam)
 *   - Canvas cover image generation
 *   - Sitemap update
 *
 * Credentials are read from the PlatformAccount table (AES-256 encrypted).
 * All steps are non-fatal — errors per platform are recorded in PublishJob.
 *
 * Sprint C additions:
 *   - SEO gate (score ≥ 70) before publishing — autoFix attempted once on failure
 *   - JSON-LD Article schema injected into HTML content pieces
 *   - Internal + external links injected into article HTML
 */
import { prisma } from '@/lib/prisma'
import { decryptCredential } from '@/lib/credentials'
import { publishToDevto } from './devto'
import { publishToHashnode } from './hashnode'
import { publishToBlogger } from './blogger'
import { publishToTumblr } from './tumblr'
import { publishToMedium } from './medium'
import { pingIndexNow } from './indexnow'
import { updateSitemap } from './sitemap'
import { generateCoverImage } from './image-generator'
import { scoreContent, autoFixSEO, SEO_GATE_SCORE } from '@/lib/seo-scorer'
import { buildArticleSchema, wrapSchemaTag } from '@/lib/schema-generator'
import { injectInternalLinks } from '@/lib/internal-linker'
import { injectExternalLinks } from '@/lib/external-linker'

const DELAY_MS = 3 * 60 * 1000 // 3 minutes between platforms (bot detection avoidance)

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface PublishInput {
  campaignId: string
  campaignName: string
  niche: string
  primaryKeyword: string
  bridgePageUrl: string
}

export interface PublishPlatformResult {
  platform: string
  success: boolean
  url?: string
  error?: string
}

export interface PublishResult {
  results: PublishPlatformResult[]
  publishedUrls: string[]
  indexNowSubmitted: boolean
  sitemapUpdated: boolean
  coverImageUrl?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getPlatformAccount(platform: string): Promise<Record<string, string> | null> {
  const account = await prisma.platformAccount.findFirst({
    where: { platform, isActive: true },
    select: { credentialsEncrypted: true },
  })
  if (!account) return null

  try {
    const decrypted = decryptCredential(account.credentialsEncrypted)
    return JSON.parse(decrypted) as Record<string, string>
  } catch {
    return null
  }
}

function extractKeywords(niche: string, primaryKeyword: string): string[] {
  const base = [
    primaryKeyword,
    niche,
    'review',
    'guide',
    'tips',
  ]
  const seen = new Set<string>()
  return base
    .map((k) => k.toLowerCase().replace(/\s+/g, '-').slice(0, 30))
    .filter((k) => { if (seen.has(k)) return false; seen.add(k); return true })
    .slice(0, 5)
}

async function getContentPiece(campaignId: string, type: string): Promise<{ contentText: string | null; contentHtml: string | null } | null> {
  return await prisma.contentPiece.findFirst({
    where: { campaignId, type },
    select: { contentText: true, contentHtml: true },
    orderBy: { createdAt: 'desc' },
  })
}

async function upsertPublishJob(
  campaignId: string,
  platform: string,
  contentPieceId: string | null,
  status: string,
  platformUrl: string | null,
  errorMessage: string | null
): Promise<void> {
  const existing = await prisma.publishJob.findFirst({
    where: { campaignId, platform },
    select: { id: true },
  })

  if (existing) {
    await prisma.publishJob.update({
      where: { id: existing.id },
      data: {
        status,
        platformUrl,
        errorMessage,
        publishedAt: status === 'published' ? new Date() : undefined,
        attemptCount: { increment: 1 },
      },
    })
  } else {
    await prisma.publishJob.create({
      data: {
        campaignId,
        platform,
        contentPieceId,
        status,
        platformUrl,
        errorMessage,
        publishedAt: status === 'published' ? new Date() : undefined,
      },
    })
  }
}

// ---------------------------------------------------------------------------
// Platform publishers
// ---------------------------------------------------------------------------

async function runDevto(input: PublishInput): Promise<PublishPlatformResult> {
  const creds = await getPlatformAccount('devto')
  if (!creds?.api_key) {
    return { platform: 'devto', success: false, error: 'No devto account configured' }
  }

  const piece = await getContentPiece(input.campaignId, 'article_devto')
  if (!piece) {
    return { platform: 'devto', success: false, error: 'No article_devto content piece found' }
  }

  try {
    const result = await publishToDevto({
      apiKey: creds.api_key,
      title: `${input.primaryKeyword} — Complete Guide`,
      bodyMarkdown: piece.contentText ?? '',
      tags: extractKeywords(input.niche, input.primaryKeyword),
      canonicalUrl: input.bridgePageUrl,
      description: (piece.contentText ?? '').slice(0, 160),
    })

    await upsertPublishJob(input.campaignId, 'devto', null, 'published', result.url, null)
    return { platform: 'devto', success: true, url: result.url }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await upsertPublishJob(input.campaignId, 'devto', null, 'failed', null, msg)
    return { platform: 'devto', success: false, error: msg }
  }
}

async function runHashnode(input: PublishInput): Promise<PublishPlatformResult> {
  const creds = await getPlatformAccount('hashnode')
  if (!creds?.api_token || !creds?.publication_id) {
    return { platform: 'hashnode', success: false, error: 'No hashnode account configured' }
  }

  const piece = await getContentPiece(input.campaignId, 'article_hashnode')
  if (!piece) {
    return { platform: 'hashnode', success: false, error: 'No article_hashnode content piece found' }
  }

  try {
    const result = await publishToHashnode({
      apiToken: creds.api_token,
      publicationId: creds.publication_id,
      title: `${input.primaryKeyword} — Complete Guide`,
      contentMarkdown: piece.contentText ?? '',
      tags: extractKeywords(input.niche, input.primaryKeyword),
      canonicalUrl: input.bridgePageUrl,
      description: (piece.contentText ?? '').slice(0, 160),
    })

    await upsertPublishJob(input.campaignId, 'hashnode', null, 'published', result.url, null)
    return { platform: 'hashnode', success: true, url: result.url }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await upsertPublishJob(input.campaignId, 'hashnode', null, 'failed', null, msg)
    return { platform: 'hashnode', success: false, error: msg }
  }
}

async function runBlogger(input: PublishInput): Promise<PublishPlatformResult> {
  const creds = await getPlatformAccount('blogger')
  if (!creds?.access_token || !creds?.blog_id) {
    return { platform: 'blogger', success: false, error: 'No blogger account configured' }
  }

  const piece = await getContentPiece(input.campaignId, 'article_blogger')
  if (!piece) {
    return { platform: 'blogger', success: false, error: 'No article_blogger content piece found' }
  }

  try {
    const contentHtml = piece.contentHtml ?? (piece.contentText ? `<p>${piece.contentText.replace(/\n\n/g, '</p><p>')}</p>` : '<p></p>')
    const result = await publishToBlogger({
      accessToken: creds.access_token,
      blogId: creds.blog_id,
      title: `${input.primaryKeyword} — Complete Guide`,
      contentHtml,
      labels: extractKeywords(input.niche, input.primaryKeyword),
      canonicalUrl: input.bridgePageUrl,
    })

    await upsertPublishJob(input.campaignId, 'blogger', null, 'published', result.url, null)
    return { platform: 'blogger', success: true, url: result.url }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await upsertPublishJob(input.campaignId, 'blogger', null, 'failed', null, msg)
    return { platform: 'blogger', success: false, error: msg }
  }
}

async function runMedium(input: PublishInput): Promise<PublishPlatformResult> {
  const creds = await getPlatformAccount('medium')
  const cookieSession = creds?.cookie_auth ?? creds?.cookie_session
  if (!creds?.integration_token && !cookieSession) {
    return { platform: 'medium', success: false, error: 'No medium account configured' }
  }

  const piece = await getContentPiece(input.campaignId, 'article_medium')
  if (!piece) {
    return { platform: 'medium', success: false, error: 'No article_medium content piece found' }
  }

  try {
    const contentHtml = piece.contentHtml ?? (piece.contentText ? `<p>${piece.contentText.replace(/\n\n/g, '</p><p>')}</p>` : '<p></p>')
    const result = await publishToMedium({
      integrationToken: creds?.integration_token,
      cookieSession,
      title: `${input.primaryKeyword} — Complete Guide`,
      contentHtml,
      tags: extractKeywords(input.niche, input.primaryKeyword),
      canonicalUrl: input.bridgePageUrl,
      publishStatus: 'public',
    })

    await upsertPublishJob(input.campaignId, 'medium', null, 'published', result.url, null)
    return { platform: 'medium', success: true, url: result.url }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await upsertPublishJob(input.campaignId, 'medium', null, 'failed', null, msg)
    return { platform: 'medium', success: false, error: msg }
  }
}

async function runTumblr(input: PublishInput): Promise<PublishPlatformResult> {
  const creds = await getPlatformAccount('tumblr')
  if (!creds?.consumer_key || !creds?.consumer_secret || !creds?.oauth_token || !creds?.oauth_token_secret || !creds?.blog_identifier) {
    return { platform: 'tumblr', success: false, error: 'No tumblr account configured' }
  }

  const piece = await getContentPiece(input.campaignId, 'article_tumblr')
  if (!piece) {
    return { platform: 'tumblr', success: false, error: 'No article_tumblr content piece found' }
  }

  try {
    const contentHtml = piece.contentHtml ?? (piece.contentText ? `<p>${piece.contentText.replace(/\n\n/g, '</p><p>')}</p>` : '<p></p>')
    const result = await publishToTumblr({
      consumerKey: creds.consumer_key,
      consumerSecret: creds.consumer_secret,
      oauthToken: creds.oauth_token,
      oauthTokenSecret: creds.oauth_token_secret,
      blogIdentifier: creds.blog_identifier,
      title: input.primaryKeyword,
      contentHtml,
      tags: extractKeywords(input.niche, input.primaryKeyword),
    })

    await upsertPublishJob(input.campaignId, 'tumblr', null, 'published', result.url, null)
    return { platform: 'tumblr', success: true, url: result.url }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await upsertPublishJob(input.campaignId, 'tumblr', null, 'failed', null, msg)
    return { platform: 'tumblr', success: false, error: msg }
  }
}

// ---------------------------------------------------------------------------
// Sprint C — SEO gate + schema injection + link injection
// ---------------------------------------------------------------------------

interface SEOGateResult {
  passed: boolean
  score: number
  issues: string[]
  /** HTML with schema + links injected (only when passed) */
  enhancedHtml: string | null
}

async function runSEOGateAndEnrich(
  html: string,
  input: PublishInput,
  briefData?: Record<string, unknown>,
): Promise<SEOGateResult> {
  const keyword = input.primaryKeyword
  const targetWordCount =
    (briefData?.targetWordCount as number | undefined) ?? 1850
  const mandatoryEntities =
    (briefData?.mandatoryEntities as string[] | undefined) ?? []
  const lsiTerms =
    (briefData?.lsiTerms as string[] | undefined) ?? []

  // Score
  let result = scoreContent(html, { keyword, targetWordCount, mandatoryEntities, lsiTerms })

  let workingHtml = html

  // One autoFix attempt on failure
  if (result.score < SEO_GATE_SCORE) {
    workingHtml = autoFixSEO(html, result, {
      html,
      keyword,
      targetWordCount,
      mandatoryEntities,
      lsiTerms,
    })
    result = scoreContent(workingHtml, { keyword, targetWordCount, mandatoryEntities, lsiTerms })
    console.log(`[publisher] SEO score after autoFix: ${result.score}`)
  }

  if (result.score < SEO_GATE_SCORE) {
    console.warn(`[publisher] SEO gate FAILED (score=${result.score}) — skipping article platforms`)
    return { passed: false, score: result.score, issues: result.issues, enhancedHtml: null }
  }

  // Inject external links (pure)
  let enrichedHtml = injectExternalLinks(workingHtml, input.niche)

  // Inject internal links (async DB lookup)
  try {
    enrichedHtml = await injectInternalLinks(enrichedHtml, input.campaignId)
  } catch (err) {
    console.warn('[publisher] Internal linker failed:', err)
  }

  // Build and inject Article JSON-LD schema
  const siteUrl = process.env.APP_BASE_URL ?? 'https://app.digitalfinds.net'
  const articleSchema = buildArticleSchema({
    title: (briefData?.proposedTitle as string | undefined) ?? input.primaryKeyword,
    url: input.bridgePageUrl,
    datePublished: new Date().toISOString(),
    description: (briefData?.proposedMetaDescription as string | undefined) ??
      input.primaryKeyword,
    authorName: process.env.SITE_AUTHOR ?? 'The Team',
    publisherName: process.env.APP_DOMAIN ?? 'AffiliateCastle',
    publisherLogoUrl: `${siteUrl}/img/logo.png`,
  })
  const schemaTag = wrapSchemaTag(articleSchema)

  if (enrichedHtml.includes('</head>')) {
    enrichedHtml = enrichedHtml.replace('</head>', `${schemaTag}\n</head>`)
  } else {
    enrichedHtml = schemaTag + '\n' + enrichedHtml
  }

  return { passed: true, score: result.score, issues: result.issues, enhancedHtml: enrichedHtml }
}

async function saveSeoScore(
  campaignId: string,
  contentType: string,
  score: number,
  issues: string[],
): Promise<void> {
  try {
    const piece = await prisma.contentPiece.findFirst({
      where: { campaignId, type: contentType },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    })
    if (piece) {
      await prisma.contentPiece.update({
        where: { id: piece.id },
        data: {
          seoScore: score,
          seoIssues: issues.slice(0, 10).join(' | '),
          status: score >= SEO_GATE_SCORE ? 'ready' : 'needs_revision',
        },
      })
    }
  } catch { /* non-fatal */ }
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export async function publishCampaign(
  input: PublishInput
): Promise<PublishResult> {
  const results: PublishPlatformResult[] = []
  const publishedUrls: string[] = [input.bridgePageUrl]

  console.log(`[publisher] Starting publish for campaign ${input.campaignId}`)

  // ── Sprint C: load content brief for SEO context ─────────────────────────
  let briefData: Record<string, unknown> | undefined
  try {
    const briefPiece = await prisma.contentPiece.findFirst({
      where: { campaignId: input.campaignId, type: 'content_brief' },
      select: { serpBriefJson: true },
      orderBy: { createdAt: 'desc' },
    })
    if (briefPiece?.serpBriefJson) {
      const raw = briefPiece.serpBriefJson as Record<string, unknown>
      briefData = (raw.contentBrief as Record<string, unknown> | undefined) ?? raw
    }
  } catch { /* non-fatal */ }

  // ── Sprint C: SEO gate on main article HTML ───────────────────────────────
  let seoGateResult: SEOGateResult | undefined
  const articlePiece = await getContentPiece(input.campaignId, 'article_blogger') ??
    await getContentPiece(input.campaignId, 'article_devto')

  if (articlePiece?.contentHtml || articlePiece?.contentText) {
    const htmlToScore = articlePiece.contentHtml ??
      `<p>${(articlePiece.contentText ?? '').replace(/\n\n/g, '</p><p>')}</p>`
    seoGateResult = await runSEOGateAndEnrich(htmlToScore, input, briefData)
    await saveSeoScore(
      input.campaignId,
      'article_blogger',
      seoGateResult.score,
      seoGateResult.issues,
    )
    console.log(`[publisher] SEO score: ${seoGateResult.score} — ${seoGateResult.passed ? 'PASS' : 'FAIL'}`)
  }

  // If SEO gate failed, skip article platforms but continue with non-article ones
  const articlePlatformsEnabled = !seoGateResult || seoGateResult.passed

  // Platform 1: dev.to (immediate)
  const devtoResult = articlePlatformsEnabled
    ? await runDevto(input)
    : { platform: 'devto', success: false, error: `SEO gate failed (score=${seoGateResult?.score})` }
  results.push(devtoResult)
  if (devtoResult.url) publishedUrls.push(devtoResult.url)
  console.log(`[publisher] devto: ${devtoResult.success ? devtoResult.url : devtoResult.error}`)

  // +3 min delay
  await sleep(DELAY_MS)

  // Platform 2: Hashnode
  const hashnodeResult = articlePlatformsEnabled
    ? await runHashnode(input)
    : { platform: 'hashnode', success: false, error: `SEO gate failed (score=${seoGateResult?.score})` }
  results.push(hashnodeResult)
  if (hashnodeResult.url) publishedUrls.push(hashnodeResult.url)
  console.log(`[publisher] hashnode: ${hashnodeResult.success ? hashnodeResult.url : hashnodeResult.error}`)

  await sleep(DELAY_MS)

  // Platform 3: Blogger
  const bloggerResult = articlePlatformsEnabled
    ? await runBlogger(input)
    : { platform: 'blogger', success: false, error: `SEO gate failed (score=${seoGateResult?.score})` }
  results.push(bloggerResult)
  if (bloggerResult.url) publishedUrls.push(bloggerResult.url)
  console.log(`[publisher] blogger: ${bloggerResult.success ? bloggerResult.url : bloggerResult.error}`)

  await sleep(DELAY_MS)

  // Platform 4: Tumblr
  const tumblrResult = articlePlatformsEnabled
    ? await runTumblr(input)
    : { platform: 'tumblr', success: false, error: `SEO gate failed (score=${seoGateResult?.score})` }
  results.push(tumblrResult)
  if (tumblrResult.url) publishedUrls.push(tumblrResult.url)
  console.log(`[publisher] tumblr: ${tumblrResult.success ? tumblrResult.url : tumblrResult.error}`)

  await sleep(DELAY_MS)

  // Platform 5: Medium
  const mediumResult = articlePlatformsEnabled
    ? await runMedium(input)
    : { platform: 'medium', success: false, error: `SEO gate failed (score=${seoGateResult?.score})` }
  results.push(mediumResult)
  if (mediumResult.url) publishedUrls.push(mediumResult.url)
  console.log(`[publisher] medium: ${mediumResult.success ? mediumResult.url : mediumResult.error}`)

  // IndexNow ping
  const appDomain = process.env.APP_DOMAIN ?? 'localhost'
  const indexNowResult = await pingIndexNow(publishedUrls, appDomain)
  console.log(`[publisher] IndexNow: submitted=${indexNowResult.submitted} urls=${indexNowResult.urlCount}`)

  // Sitemap update
  let sitemapUpdated = false
  try {
    const baseUrl = process.env.APP_BASE_URL ?? `https://${appDomain}`
    await updateSitemap(baseUrl)
    sitemapUpdated = true
    console.log('[publisher] Sitemap updated')
  } catch (err) {
    console.error('[publisher] Sitemap update failed:', err)
  }

  // Cover image
  let coverImageUrl: string | undefined
  try {
    const imgResult = await generateCoverImage({
      campaignId: input.campaignId,
      slug: 'cover',
      headline: input.primaryKeyword,
      brandName: process.env.APP_DOMAIN ?? 'AffiliateCastle',
    })
    coverImageUrl = imgResult.publicUrl
    console.log(`[publisher] Cover image: ${coverImageUrl}`)
  } catch (err) {
    console.error('[publisher] Cover image failed:', err)
  }

  return {
    results,
    publishedUrls,
    indexNowSubmitted: indexNowResult.submitted,
    sitemapUpdated,
    coverImageUrl,
  }
}
