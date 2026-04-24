/**
 * POST /api/t/optin
 *
 * Handles bridge page opt-in form submissions. Records the subscriber and
 * stores a ClickEvent attributed to the bridge page's short code.
 * No auth required (public-facing).
 *
 * Body: { email: string, name?: string, campaignId: string, shortCode?: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordClick } from '@/lib/tracking'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

function getRawIp(req: NextRequest): string {
  const headersList = headers()
  const forwarded = headersList.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.ip ?? '0.0.0.0'
}

// Basic email format validation — no external libs required
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : null
  const campaignId = typeof body.campaignId === 'string' ? body.campaignId : null
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : null
  const shortCode = typeof body.shortCode === 'string' ? body.shortCode : null

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'valid email required' }, { status: 400 })
  }

  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
  }

  // Upsert subscriber — idempotent for the same email
  await prisma.emailSubscriber.upsert({
    where: { email },
    create: {
      email,
      firstName: name,
      sourceCampaignId: campaignId,
      nicheTag: null,
      status: 'active',
    },
    update: {
      // Do not overwrite existing consent data
    },
  })

  // Also record a click from the opt-in CTA if a short code is provided
  if (shortCode) {
    try {
      await recordClick({
        shortCode,
        rawIp: getRawIp(req),
        userAgent: req.headers.get('user-agent'),
        referrer: req.headers.get('referer'),
        utmSource: 'optin',
      })
    } catch {
      // Non-fatal — subscriber is still saved
    }
  }

  // Increment BridgePage opt-ins counter if bridgePageId is provided
  const bridgePageId = typeof body.bridgePageId === 'string' ? body.bridgePageId : null
  if (bridgePageId) {
    await prisma.bridgePage.update({
      where: { id: bridgePageId },
      data: { optIns: { increment: 1 } },
    }).catch(() => { /* non-fatal */ })
  }

  return NextResponse.json({ ok: true })
}
