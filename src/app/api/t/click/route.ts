/**
 * POST /api/t/click
 *
 * Called by the `data-track` JS on bridge page CTAs. Records a click event
 * for the given short code. No auth required (public-facing bridge pages).
 *
 * Body: { shortCode: string, referrer?: string, utmSource?: string, utmMedium?: string }
 *
 * Rate limit: 60 clicks per IP per 60 s  (prevents click-flood abuse)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { recordClick, hashIp } from '@/lib/tracking'
import { rateLimit } from '@/lib/rate-limiter'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

const clickSchema = z.object({
  shortCode: z.string().min(1).max(64),
  referrer: z.string().max(2048).optional().nullable(),
  utmSource: z.string().max(100).optional().nullable(),
  utmMedium: z.string().max(100).optional().nullable(),
})

function getRawIp(req: NextRequest): string {
  const headersList = headers()
  const forwarded = headersList.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.ip ?? '0.0.0.0'
}

export async function POST(req: NextRequest) {
  // Rate limiting — use IP hash as identifier (GDPR-safe)
  const rawIp = getRawIp(req)
  const ipHash = hashIp(rawIp)
  if (!rateLimit('click', ipHash, { requests: 60, windowSec: 60 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const parsed = clickSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const { shortCode, referrer, utmSource, utmMedium } = parsed.data

  try {
    const result = await recordClick({
      shortCode,
      rawIp,
      userAgent: req.headers.get('user-agent'),
      referrer: referrer ?? req.headers.get('referer'),
      utmSource: utmSource ?? null,
      utmMedium: utmMedium ?? null,
    })
    return NextResponse.json({ ok: true, isUnique: result.isUnique })
  } catch {
    return NextResponse.json({ ok: false }, { status: 404 })
  }
}
