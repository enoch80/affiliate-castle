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
// Main orchestrator
// ---------------------------------------------------------------------------

export async function publishCampaign(
  input: PublishInput
): Promise<PublishResult> {
  const results: PublishPlatformResult[] = []
  const publishedUrls: string[] = [input.bridgePageUrl]

  console.log(`[publisher] Starting publish for campaign ${input.campaignId}`)

  // Platform 1: dev.to (immediate)
  const devtoResult = await runDevto(input)
  results.push(devtoResult)
  if (devtoResult.url) publishedUrls.push(devtoResult.url)
  console.log(`[publisher] devto: ${devtoResult.success ? devtoResult.url : devtoResult.error}`)

  // +3 min delay
  await sleep(DELAY_MS)

  // Platform 2: Hashnode
  const hashnodeResult = await runHashnode(input)
  results.push(hashnodeResult)
  if (hashnodeResult.url) publishedUrls.push(hashnodeResult.url)
  console.log(`[publisher] hashnode: ${hashnodeResult.success ? hashnodeResult.url : hashnodeResult.error}`)

  await sleep(DELAY_MS)

  // Platform 3: Blogger
  const bloggerResult = await runBlogger(input)
  results.push(bloggerResult)
  if (bloggerResult.url) publishedUrls.push(bloggerResult.url)
  console.log(`[publisher] blogger: ${bloggerResult.success ? bloggerResult.url : bloggerResult.error}`)

  await sleep(DELAY_MS)

  // Platform 4: Tumblr
  const tumblrResult = await runTumblr(input)
  results.push(tumblrResult)
  if (tumblrResult.url) publishedUrls.push(tumblrResult.url)
  console.log(`[publisher] tumblr: ${tumblrResult.success ? tumblrResult.url : tumblrResult.error}`)

  await sleep(DELAY_MS)

  // Platform 5: Medium
  const mediumResult = await runMedium(input)
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
