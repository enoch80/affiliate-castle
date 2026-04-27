/**
 * POST /api/settings/verify           — test credentials from request body (before saving)
 * GET  /api/settings/verify?platform= — test stored credentials for a platform (after saving)
 *
 * POST body: { platform: string, credentials: Record<string, string> }
 * GET  response: { ok: boolean, username?: string, metadata?: Record<string, string>, error?: string }
 *
 * Requires auth. Does NOT save anything — verify only.
 * Auto-refresh: if TOKEN_EXPIRED is returned for an OAuth2 platform, silently refreshes and retries.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { decryptCredential } from '@/lib/credentials'
import { prisma } from '@/lib/prisma'
import { verifyPlatform, getPlatform } from '@/lib/platform-registry'
import { z } from 'zod'

// ── POST — verify credentials from request body (before saving) ───────────────

const postSchema = z.object({
  platform: z.string().min(1),
  credentials: z.record(z.string()),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const { platform, credentials } = parsed.data

  try { getPlatform(platform) } catch {
    return NextResponse.json({ error: `Unknown platform: ${platform}` }, { status: 400 })
  }

  const result = await verifyPlatform(platform, credentials)
  return NextResponse.json(result, { status: result.ok ? 200 : 422 })
}

// ── GET — test already-stored credentials for a platform ─────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const platform = searchParams.get('platform')
  if (!platform) return NextResponse.json({ error: 'platform query param required' }, { status: 400 })

  try { getPlatform(platform) } catch {
    return NextResponse.json({ error: `Unknown platform: ${platform}` }, { status: 400 })
  }

  const account = await prisma.platformAccount.findFirst({
    where: { platform, isActive: true },
    select: { id: true, credentialsEncrypted: true },
  })
  if (!account) {
    return NextResponse.json({ ok: false, error: 'No account stored for this platform' }, { status: 404 })
  }

  let creds: Record<string, string>
  try {
    creds = JSON.parse(decryptCredential(account.credentialsEncrypted)) as Record<string, string>
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to decrypt stored credentials' }, { status: 500 })
  }

  let result = await verifyPlatform(platform, creds)

  // Auto-refresh: if TOKEN_EXPIRED and platform supports OAuth2 refresh, try once silently
  if (!result.ok && result.error === 'TOKEN_EXPIRED') {
    const entry = getPlatform(platform)
    if (entry.authType === 'oauth2' && creds.refresh_token) {
      try {
        const refreshRes = await fetch(`${process.env.NEXTAUTH_URL ?? ''}/api/auth/oauth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: req.headers.get('cookie') ?? '' },
          body: JSON.stringify({ platform }),
        })
        if (refreshRes.ok) {
          const updated = await prisma.platformAccount.findFirst({
            where: { platform, isActive: true },
            select: { credentialsEncrypted: true },
          })
          if (updated) {
            const newCreds = JSON.parse(decryptCredential(updated.credentialsEncrypted)) as Record<string, string>
            result = await verifyPlatform(platform, newCreds)
          }
        }
      } catch { /* swallow — fall through to error */ }
    }
    if (!result.ok && result.error === 'TOKEN_EXPIRED') {
      result = { ok: false, error: 'Access token expired — click Reconnect to re-authorise.' }
    }
  }

  return NextResponse.json(result)
}
