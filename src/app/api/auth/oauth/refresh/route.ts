/**
 * POST /api/auth/oauth/refresh
 * Body: { platform: string }
 *
 * Silently refreshes an OAuth2 access_token using the stored refresh_token.
 * Called automatically by settings/verify when a platform returns TOKEN_EXPIRED.
 * The caller never sees "token expired" — it retries after refresh.
 *
 * Updates credentialsEncrypted and tokenExpiresAt in PlatformAccount.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPlatform } from '@/lib/platform-registry'
import { encryptCredential, decryptCredential } from '@/lib/credentials'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const bodySchema = z.object({ platform: z.string().min(1) })

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'platform is required' }, { status: 400 })

  const { platform } = parsed.data

  let entry
  try { entry = getPlatform(platform) } catch {
    return NextResponse.json({ error: `Unknown platform: ${platform}` }, { status: 400 })
  }

  if (entry.authType !== 'oauth2') {
    return NextResponse.json({ error: `${platform} does not use OAuth2 refresh tokens` }, { status: 400 })
  }

  const account = await prisma.platformAccount.findFirst({ where: { platform, isActive: true } })
  if (!account) return NextResponse.json({ error: 'No account stored for this platform' }, { status: 404 })

  let creds: Record<string, string>
  try {
    creds = JSON.parse(decryptCredential(account.credentialsEncrypted)) as Record<string, string>
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt stored credentials' }, { status: 500 })
  }

  const refreshToken = creds.refresh_token
  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh_token stored — user must reconnect' }, { status: 422 })
  }

  const cfg = entry.oauth2!
  const clientId = process.env[cfg.clientIdEnvVar] ?? ''
  const clientSecret = process.env[cfg.clientSecretEnvVar] ?? ''

  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  })

  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok || json.error) {
    const msg = String(json.error_description ?? json.error ?? `HTTP ${res.status}`)
    return NextResponse.json({ ok: false, error: msg }, { status: 422 })
  }

  const newAccessToken = String(json.access_token)
  const newRefreshToken = json.refresh_token ? String(json.refresh_token) : refreshToken
  const expiresIn = json.expires_in ? Number(json.expires_in) : null

  creds.access_token = newAccessToken
  creds.refresh_token = newRefreshToken

  const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null

  await prisma.platformAccount.update({
    where: { id: account.id },
    data: {
      credentialsEncrypted: encryptCredential(JSON.stringify(creds)),
      tokenExpiresAt: tokenExpiresAt ?? undefined,
      lastUsedAt: new Date(),
    },
  })

  return NextResponse.json({ ok: true })
}
