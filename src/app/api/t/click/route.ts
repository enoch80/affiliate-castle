/**
 * POST /api/t/click
 *
 * Called by the `data-track` JS on bridge page CTAs. Records a click event
 * for the given short code. No auth required (public-facing bridge pages).
 *
 * Body: { shortCode: string, referrer?: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { recordClick } from '@/lib/tracking'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

function getRawIp(req: NextRequest): string {
  const headersList = headers()
  const forwarded = headersList.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.ip ?? '0.0.0.0'
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const shortCode = typeof body.shortCode === 'string' ? body.shortCode : null
  if (!shortCode) {
    return NextResponse.json({ error: 'shortCode required' }, { status: 400 })
  }

  try {
    const result = await recordClick({
      shortCode,
      rawIp: getRawIp(req),
      userAgent: req.headers.get('user-agent'),
      referrer: typeof body.referrer === 'string' ? body.referrer : req.headers.get('referer'),
      utmSource: typeof body.utmSource === 'string' ? body.utmSource : null,
      utmMedium: typeof body.utmMedium === 'string' ? body.utmMedium : null,
    })
    return NextResponse.json({ ok: true, isUnique: result.isUnique })
  } catch {
    return NextResponse.json({ ok: false }, { status: 404 })
  }
}
