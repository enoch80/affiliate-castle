/**
 * POST /api/t/optin
 *
 * Handles bridge page opt-in form submissions. Records the subscriber and
 * stores a ClickEvent attributed to the bridge page's short code.
 * No auth required (public-facing).
 *
 * Body: { email: string, name?: string, campaignId: string, shortCode?: string, bridgePageId?: string }
 *
 * Rate limit: 5 opt-ins per IP per 10 min  (prevents form-spam abuse)
 * GDPR: subscribedAt records the consent timestamp; IP stored only as SHA-256 hash.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { recordClick, hashIp } from '@/lib/tracking'
import { rateLimit } from '@/lib/rate-limiter'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

const optinSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().max(100).optional().nullable(),
  campaignId: z.string().min(1).max(64),
  shortCode: z.string().max(64).optional().nullable(),
  bridgePageId: z.string().max(64).optional().nullable(),
})

function getRawIp(req: NextRequest): string {
  const headersList = headers()
  const forwarded = headersList.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.ip ?? '0.0.0.0'
}

export async function POST(req: NextRequest) {
  // Rate limiting — 5 opt-ins per IP per 10 min (GDPR-safe: use IP hash)
  const rawIp = getRawIp(req)
  const ipHash = hashIp(rawIp)
  if (!rateLimit('optin', ipHash, { requests: 5, windowSec: 600 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const parsed = optinSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const { email, name, campaignId, shortCode, bridgePageId } = parsed.data
  const normalizedEmail = email.trim().toLowerCase()

  // Upsert subscriber — idempotent for same email; subscribedAt = GDPR consent timestamp
  await prisma.emailSubscriber.upsert({
    where: { email: normalizedEmail },
    create: {
      email: normalizedEmail,
      firstName: name ?? null,
      sourceCampaignId: campaignId,
      nicheTag: null,
      status: 'active',
      // subscribedAt is @default(now()) — records the GDPR consent timestamp
    },
    update: {
      // Do not overwrite existing consent data on re-submission
    },
  })

  // Also record a click from the opt-in CTA if a short code is provided
  if (shortCode) {
    try {
      await recordClick({
        shortCode,
        rawIp,
        userAgent: req.headers.get('user-agent'),
        referrer: req.headers.get('referer'),
        utmSource: 'optin',
      })
    } catch {
      // Non-fatal — subscriber is still saved
    }
  }

  // Increment BridgePage opt-ins counter if bridgePageId is provided
  if (bridgePageId) {
    await prisma.bridgePage.update({
      where: { id: bridgePageId },
      data: { optIns: { increment: 1 } },
    }).catch(() => { /* non-fatal */ })
  }

  return NextResponse.json({ ok: true })
}
