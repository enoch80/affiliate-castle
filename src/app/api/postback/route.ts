/**
 * GET /api/postback
 *
 * Affiliate network postback endpoint. Accepts conversion notifications from
 * ClickBank, JVZoo, Digistore24, and a generic format.
 *
 * Security:
 *  - IP whitelist check (POSTBACK_IP_WHITELIST env var — comma-separated IPs)
 *  - Dedup on networkTransactionId (unique constraint in DB)
 *  - No auth session required — postbacks come from affiliate networks
 *
 * Network formats:
 *  ClickBank:   ?tid=<shortCode>&cbreceipt=<txId>&amount=<revenue>
 *  JVZoo:       ?customid=<shortCode>&transid=<txId>&amount=<cents>
 *  Digistore24: ?cpersoparam=<shortCode>&order_id=<txId>&order_total=<revenue>
 *  Generic:     ?sub=<shortCode>&txid=<txId>&revenue=<revenue>
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  parsePostback,
  recordConversion,
  isPostbackIpAllowed,
} from '@/lib/tracking'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

function getRawIp(req: NextRequest): string {
  const headersList = headers()
  const forwarded = headersList.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.ip ?? '0.0.0.0'
}

export async function GET(req: NextRequest) {
  const rawIp = getRawIp(req)

  if (!isPostbackIpAllowed(rawIp)) {
    // Return 200 to affiliate networks (they expect 200 even on rejection)
    // Log for audit but don't expose reason
    console.warn(`[postback] Rejected IP: ${rawIp}`)
    return new NextResponse('OK', { status: 200 })
  }

  const url = new URL(req.url)
  const params: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    params[key] = value
  })

  const parsed = parsePostback(params)
  if (!parsed) {
    console.warn(`[postback] Unrecognised format from ${rawIp}:`, params)
    return new NextResponse('OK', { status: 200 })
  }

  try {
    const result = await recordConversion(parsed)

    if (result.isDuplicate) {
      console.log(`[postback] Duplicate txId: ${parsed.networkTransactionId}`)
    } else {
      console.log(
        `[postback] Conversion recorded: ${result.conversionId} ` +
          `network=${parsed.network} revenue=${parsed.revenue} ` +
          `txId=${parsed.networkTransactionId ?? 'none'}`
      )
    }
  } catch (err) {
    // Unknown shortCode — log but still return 200 to the network
    console.error(`[postback] Error recording conversion:`, err)
  }

  // Affiliate networks require a plain 200 OK
  return new NextResponse('OK', { status: 200 })
}

// Some networks POST instead of GET — support both
export { GET as POST }
