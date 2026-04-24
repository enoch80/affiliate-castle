/**
 * GET /api/r/[code]
 *
 * Public redirect endpoint. Records click event then 302-redirects to the
 * destination hoplink. Works without authentication (public traffic).
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

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const { code } = params
  const url = new URL(req.url)

  try {
    const result = await recordClick({
      shortCode: code,
      rawIp: getRawIp(req),
      userAgent: req.headers.get('user-agent'),
      referrer: req.headers.get('referer'),
      utmSource: url.searchParams.get('utm_source'),
      utmMedium: url.searchParams.get('utm_medium'),
    })

    return NextResponse.redirect(result.redirectUrl, { status: 302 })
  } catch {
    // Unknown short code — redirect to home rather than hard 404
    return NextResponse.redirect(
      process.env.APP_BASE_URL ?? 'http://localhost:3200',
      { status: 302 }
    )
  }
}
