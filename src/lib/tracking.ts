/**
 * Sprint 6 — Tracking Engine
 *
 * Responsibilities:
 *  - Create per-platform TrackingLink records for a campaign
 *  - Record click events with IP dedup (1 unique/IP-hash/campaign/24h)
 *  - Record affiliate-network postback conversions with dedup on networkTransactionId
 *  - Hash raw IPs (SHA-256) — never store raw IPs (GDPR)
 */
import crypto from 'crypto'
import { prisma } from './prisma'

// --------------------------------------------------------------------------
// Known ClickBank postback IP ranges (primary relay server CIDR blocks).
// Add JVZoo and Digistore24 known ranges here as confirmed in production.
// An empty whitelist means ALL IPs are accepted (useful during initial rollout).
// --------------------------------------------------------------------------
const POSTBACK_IP_WHITELIST: string[] = (
  process.env.POSTBACK_IP_WHITELIST ?? ''
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// --------------------------------------------------------------------------
// Platform sources — one TrackingLink is created per source per campaign
// --------------------------------------------------------------------------
export const PLATFORM_SOURCES = [
  'devto',
  'hashnode',
  'blogger',
  'tumblr',
  'telegram',
  'email',
  'direct',
] as const

export type PlatformSource = (typeof PLATFORM_SOURCES)[number]

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/** Hash a raw IP address to SHA-256 hex. Never store the raw IP. */
export function hashIp(rawIp: string): string {
  return crypto.createHash('sha256').update(rawIp).digest('hex')
}

/** Generate a compact URL-safe short code (8 chars). */
export function generateShortCode(): string {
  return crypto.randomBytes(6).toString('base64url').slice(0, 8)
}

/** Determine device type from User-Agent string. */
function detectDeviceType(ua: string | null | undefined): string {
  if (!ua) return 'unknown'
  const lower = ua.toLowerCase()
  if (/mobile|android|iphone|ipad/.test(lower)) return 'mobile'
  if (/tablet/.test(lower)) return 'tablet'
  return 'desktop'
}

/** Bucket the current UTC hour into a readable label. */
function timeOfDayBucket(): string {
  const h = new Date().getUTCHours()
  if (h >= 7 && h < 10) return 'morning'
  if (h >= 12 && h < 14) return 'lunch'
  if (h >= 20 && h < 23) return 'evening'
  return 'off-peak'
}

// --------------------------------------------------------------------------
// Create tracking links for a campaign
// --------------------------------------------------------------------------

export interface CreateLinksInput {
  campaignId: string
  hoplink: string
}

export interface CreateLinksResult {
  links: Array<{
    id: string
    shortCode: string
    platformSource: string
    publicUrl: string
  }>
}

/**
 * Idempotent — if links already exist for this campaign they are returned
 * unchanged without creating duplicates.
 */
export async function createTrackingLinks(
  input: CreateLinksInput,
  baseUrl: string = process.env.APP_BASE_URL ?? 'http://localhost:3200'
): Promise<CreateLinksResult> {
  const existing = await prisma.trackingLink.findMany({
    where: { campaignId: input.campaignId },
    select: { id: true, shortCode: true, platformSource: true },
  })

  if (existing.length >= PLATFORM_SOURCES.length) {
    return {
      links: existing.map((l) => ({
        id: l.id,
        shortCode: l.shortCode,
        platformSource: l.platformSource ?? 'direct',
        publicUrl: `${baseUrl}/api/r/${l.shortCode}`,
      })),
    }
  }

  const existingSources = new Set(existing.map((l) => l.platformSource))
  const toCreate = PLATFORM_SOURCES.filter((src) => !existingSources.has(src))

  const created = await Promise.all(
    toCreate.map(async (platformSource) => {
      let shortCode = generateShortCode()
      // Ensure uniqueness in the very unlikely collision case
      while (await prisma.trackingLink.findUnique({ where: { shortCode } })) {
        shortCode = generateShortCode()
      }
      const link = await prisma.trackingLink.create({
        data: {
          campaignId: input.campaignId,
          shortCode,
          destinationUrl: input.hoplink,
          platformSource,
        },
        select: { id: true, shortCode: true, platformSource: true },
      })
      return link
    })
  )

  const all = [
    ...existing.map((l) => ({
      id: l.id,
      shortCode: l.shortCode,
      platformSource: l.platformSource ?? 'direct',
      publicUrl: `${baseUrl}/api/r/${l.shortCode}`,
    })),
    ...created.map((l) => ({
      id: l.id,
      shortCode: l.shortCode,
      platformSource: l.platformSource ?? 'direct',
      publicUrl: `${baseUrl}/api/r/${l.shortCode}`,
    })),
  ]

  return { links: all }
}

// --------------------------------------------------------------------------
// Record a click event
// --------------------------------------------------------------------------

export interface RecordClickInput {
  shortCode: string
  rawIp: string
  userAgent?: string | null
  referrer?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  countryCode?: string | null
}

export interface RecordClickResult {
  isUnique: boolean
  redirectUrl: string
}

/**
 * Records a click event with dedup: 1 unique click per IP-hash per campaign
 * per 24-hour window. Always increments raw clicks; only increments uniqueClicks
 * and campaign.totalClicks when dedup passes.
 */
export async function recordClick(input: RecordClickInput): Promise<RecordClickResult> {
  const link = await prisma.trackingLink.findUnique({
    where: { shortCode: input.shortCode },
    include: { campaign: { select: { id: true } } },
  })

  if (!link) {
    throw new Error(`TrackingLink not found: ${input.shortCode}`)
  }

  const ipHash = hashIp(input.rawIp)
  const window24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // Dedup check: same IP-hash within this campaign in last 24h
  const recentClick = await prisma.clickEvent.findFirst({
    where: {
      trackingLink: { campaignId: link.campaign.id },
      ipHash,
      clickedAt: { gte: window24h },
    },
    select: { id: true },
  })

  const isUnique = !recentClick

  await prisma.$transaction([
    prisma.clickEvent.create({
      data: {
        trackingLinkId: link.id,
        ipHash,
        userAgent: input.userAgent ?? null,
        referrer: input.referrer ?? null,
        utmSource: input.utmSource ?? null,
        utmMedium: input.utmMedium ?? null,
        countryCode: input.countryCode ?? null,
        deviceType: detectDeviceType(input.userAgent),
        timeOfDayBucket: timeOfDayBucket(),
      },
    }),
    prisma.trackingLink.update({
      where: { id: link.id },
      data: {
        clicks: { increment: 1 },
        ...(isUnique ? { uniqueClicks: { increment: 1 } } : {}),
      },
    }),
    ...(isUnique
      ? [
          prisma.campaign.update({
            where: { id: link.campaign.id },
            data: { totalClicks: { increment: 1 } },
          }),
        ]
      : []),
  ])

  return { isUnique, redirectUrl: link.destinationUrl }
}

// --------------------------------------------------------------------------
// Record a postback conversion
// --------------------------------------------------------------------------

export type NetworkName = 'clickbank' | 'jvzoo' | 'digistore24' | 'generic'

export interface ParsedPostback {
  network: NetworkName
  shortCode: string
  revenue: number
  networkTransactionId?: string
  raw: Record<string, string>
}

/**
 * Extracts the tracking short code and revenue from a raw postback query string
 * for each of the 4 supported affiliate networks.
 */
export function parsePostback(
  params: Record<string, string>
): ParsedPostback | null {
  // ClickBank: tid=<shortCode>, cbreceipt=<txId>, amount=<revenue>
  if (params['tid']) {
    return {
      network: 'clickbank',
      shortCode: params['tid'],
      revenue: parseFloat(params['amount'] ?? params['sale_amount'] ?? '0') || 0,
      networkTransactionId: params['cbreceipt'] ?? params['receipt'] ?? undefined,
      raw: params,
    }
  }

  // JVZoo: customid=<shortCode>, transid=<txId>, amount=<revenue (cents)>
  if (params['customid']) {
    const cents = parseFloat(params['amount'] ?? '0') || 0
    return {
      network: 'jvzoo',
      shortCode: params['customid'],
      revenue: cents / 100,
      networkTransactionId: params['transid'] ?? undefined,
      raw: params,
    }
  }

  // Digistore24: cpersoparam=<shortCode>, order_id=<txId>, order_total=<revenue>
  if (params['cpersoparam']) {
    return {
      network: 'digistore24',
      shortCode: params['cpersoparam'],
      revenue: parseFloat(params['order_total'] ?? '0') || 0,
      networkTransactionId: params['order_id'] ?? undefined,
      raw: params,
    }
  }

  // Generic: sub=<shortCode>, txid=<txId>, revenue=<revenue>
  if (params['sub']) {
    return {
      network: 'generic',
      shortCode: params['sub'],
      revenue: parseFloat(params['revenue'] ?? '0') || 0,
      networkTransactionId: params['txid'] ?? undefined,
      raw: params,
    }
  }

  return null
}

export interface RecordConversionResult {
  conversionId: string
  isDuplicate: boolean
}

/**
 * Records a conversion. Deduplicates on networkTransactionId.
 * Updates campaign.totalConversions and TrackingLink.conversions.
 */
export async function recordConversion(
  parsed: ParsedPostback
): Promise<RecordConversionResult> {
  // Dedup on networkTransactionId
  if (parsed.networkTransactionId) {
    const existing = await prisma.conversion.findUnique({
      where: { networkTransactionId: parsed.networkTransactionId },
      select: { id: true },
    })
    if (existing) {
      return { conversionId: existing.id, isDuplicate: true }
    }
  }

  const link = await prisma.trackingLink.findUnique({
    where: { shortCode: parsed.shortCode },
    include: { campaign: { select: { id: true } } },
  })

  if (!link) {
    throw new Error(`TrackingLink not found for shortCode: ${parsed.shortCode}`)
  }

  const conversion = await prisma.$transaction(async (tx) => {
    const conv = await tx.conversion.create({
      data: {
        trackingLinkId: link.id,
        campaignId: link.campaign.id,
        revenue: parsed.revenue,
        networkTransactionId: parsed.networkTransactionId ?? null,
        postbackRaw: parsed.raw,
      },
    })
    await tx.campaign.update({
      where: { id: link.campaign.id },
      data: { totalConversions: { increment: 1 } },
    })
    return conv
  })

  return { conversionId: conversion.id, isDuplicate: false }
}

// --------------------------------------------------------------------------
// IP whitelist check for postback endpoints
// --------------------------------------------------------------------------

/**
 * Returns true if the IP is allowed to submit postbacks.
 * When POSTBACK_IP_WHITELIST is empty, all IPs are accepted.
 */
export function isPostbackIpAllowed(rawIp: string): boolean {
  if (POSTBACK_IP_WHITELIST.length === 0) return true
  return POSTBACK_IP_WHITELIST.includes(rawIp)
}
