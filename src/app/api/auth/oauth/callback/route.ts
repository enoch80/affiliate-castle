/**
 * GET /api/auth/oauth/callback?platform=X&code=Y&state=Z
 *      (also used for OAuth1: ?platform=X&oauth_token=T&oauth_verifier=V)
 *
 * This is the redirect URI registered in every platform's developer console:
 *   https://app.digitalfinds.net/api/auth/oauth/callback
 *
 * Flow:
 *   1. Verify state cookie matches query state (CSRF).
 *   2. For OAuth2: exchange code for access_token + refresh_token.
 *   3. For OAuth1: exchange oauth_verifier for final access tokens.
 *   4. Call platform verifier to get username + metadata.
 *   5. Encrypt credentials and upsert PlatformAccount.
 *   6. Return HTML that postMessages {ok, platform, username} to opener and closes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import crypto from 'crypto'
import { authOptions } from '@/lib/auth'
import { getPlatform } from '@/lib/platform-registry'
import { encryptCredential } from '@/lib/credentials'
import { prisma } from '@/lib/prisma'

const REDIRECT_URI = `${process.env.NEXTAUTH_URL ?? ''}/api/auth/oauth/callback`

function verifyState(cookieState: string, queryState: string): { platform: string } | null {
  if (!cookieState || !queryState || cookieState !== queryState) return null
  try {
    const [payloadB64] = queryState.split('.')
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as Record<string, string>
    // Expire after 10 minutes
    if (!payload.iat || Date.now() - Number(payload.iat) > 10 * 60 * 1000) return null
    if (!payload.platform) return null
    return { platform: payload.platform }
  } catch {
    return null
  }
}

function popupPage(ok: boolean, platform: string, username: string, error?: string): NextResponse {
  const data = ok
    ? `{ ok: true, platform: ${JSON.stringify(platform)}, username: ${JSON.stringify(username)} }`
    : `{ ok: false, platform: ${JSON.stringify(platform)}, error: ${JSON.stringify(error ?? 'OAuth failed')} }`

  const html = `<!DOCTYPE html>
<html>
<head><title>Connecting…</title></head>
<body style="background:#0f172a;color:#e2e8f0;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
  <div style="text-align:center">
    <div style="font-size:2rem;margin-bottom:1rem">${ok ? '✓' : '✗'}</div>
    <div style="font-size:1rem;color:${ok ? '#34d399' : '#f87171'}">${ok ? `Connected as ${username}` : (error ?? 'Connection failed')}</div>
  </div>
  <script>
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(${data}, window.location.origin);
      }
    } catch(e) {}
    setTimeout(() => window.close(), 1500);
  </script>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      // Clear state cookies
      'Set-Cookie': [
        'oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0',
        'oauth_pkce=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0',
        'oauth_tmp_secret=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0',
      ].join(', '),
    },
  })
}

/** Exchange OAuth2 code for tokens */
async function oauth2Exchange(
  platform: string,
  code: string,
  codeVerifier: string | null
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number } | { error: string }> {
  const entry = getPlatform(platform)
  const cfg = entry.oauth2!
  const clientId = process.env[cfg.clientIdEnvVar] ?? ''
  const clientSecret = process.env[cfg.clientSecretEnvVar] ?? ''

  const body: Record<string, string> = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    client_secret: clientSecret,
  }
  if (codeVerifier) body.code_verifier = codeVerifier

  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(body).toString(),
  })

  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok || json.error) {
    return { error: String(json.error_description ?? json.error ?? `HTTP ${res.status}`) }
  }
  return {
    access_token: String(json.access_token),
    refresh_token: json.refresh_token ? String(json.refresh_token) : undefined,
    expires_in: json.expires_in ? Number(json.expires_in) : undefined,
  }
}

/** Exchange OAuth1 verifier for final access tokens (Tumblr) */
async function oauth1Exchange(
  oauthToken: string,
  oauthTokenSecret: string,
  oauthVerifier: string
): Promise<{ oauth_token: string; oauth_token_secret: string } | { error: string }> {
  const consumerKey = process.env.TUMBLR_CONSUMER_KEY ?? ''
  const consumerSecret = process.env.TUMBLR_CONSUMER_SECRET ?? ''

  const nonce = crypto.randomBytes(16).toString('hex')
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const accessTokenUrl = 'https://www.tumblr.com/oauth/access_token'

  const params: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: oauthToken,
    oauth_verifier: oauthVerifier,
    oauth_version: '1.0',
  }

  const paramStr = Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&')

  const baseStr = `POST&${encodeURIComponent(accessTokenUrl)}&${encodeURIComponent(paramStr)}`
  const sigKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(oauthTokenSecret)}`
  params.oauth_signature = crypto.createHmac('sha1', sigKey).update(baseStr).digest('base64')

  const authHeader = 'OAuth ' + Object.keys(params)
    .filter((k) => k.startsWith('oauth_'))
    .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(params[k])}"`)
    .join(', ')

  const res = await fetch(accessTokenUrl, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  if (!res.ok) return { error: `Tumblr access_token failed: HTTP ${res.status}` }

  const body = await res.text()
  const p = new URLSearchParams(body)
  const token = p.get('oauth_token')
  const secret = p.get('oauth_token_secret')
  if (!token || !secret) return { error: 'Tumblr did not return final tokens' }
  return { oauth_token: token, oauth_token_secret: secret }
}

export async function GET(req: NextRequest) {
  // Session not strictly required here (popup context) but we verify state JWT instead
  const session = await getServerSession(authOptions)
  if (!session) return popupPage(false, '', '', 'Not authenticated — please log in first')

  const { searchParams } = req.nextUrl
  const platform = searchParams.get('platform') ?? ''
  const code = searchParams.get('code')
  const queryState = searchParams.get('state') ?? ''
  const oauthToken = searchParams.get('oauth_token') // OAuth1
  const oauthVerifier = searchParams.get('oauth_verifier') // OAuth1
  const errorParam = searchParams.get('error')

  if (errorParam) return popupPage(false, platform, '', `Authorization denied: ${errorParam}`)

  let entry
  try { entry = getPlatform(platform) } catch {
    return popupPage(false, platform, '', `Unknown platform: ${platform}`)
  }

  // ── Read cookies ─────────────────────────────────────────────────────────────
  const cookieState = decodeURIComponent(req.cookies.get('oauth_state')?.value ?? '')
  const cookiePkce = decodeURIComponent(req.cookies.get('oauth_pkce')?.value ?? '')
  const cookieTmpSecret = decodeURIComponent(req.cookies.get('oauth_tmp_secret')?.value ?? '')

  // ── OAuth1 (Tumblr) ──────────────────────────────────────────────────────────
  if (entry.authType === 'oauth1') {
    if (!oauthToken || !oauthVerifier) return popupPage(false, platform, '', 'Missing oauth_token or oauth_verifier')
    if (!cookieTmpSecret) return popupPage(false, platform, '', 'Session expired — please try again')

    const result = await oauth1Exchange(oauthToken, cookieTmpSecret, oauthVerifier)
    if ('error' in result) return popupPage(false, platform, '', result.error)

    // Get blog info for username
    const consumerKey = process.env[entry.oauth1!.consumerKeyEnvVar] ?? ''
    // Verify with the new tokens + consumer_key so blog_identifier is fetched
    // We use a simplified Tumblr info call using the access token
    const infoRes = await fetch('https://api.tumblr.com/v2/user/info', {
      headers: {
        Authorization: `OAuth oauth_consumer_key="${consumerKey}",oauth_token="${result.oauth_token}",oauth_signature_method="PLAINTEXT",oauth_signature="${encodeURIComponent(process.env[entry.oauth1!.consumerSecretEnvVar] ?? '')}&${encodeURIComponent(result.oauth_token_secret)}"`,
      },
    })
    let username = 'tumblr-user'
    let blogIdentifier = ''
    if (infoRes.ok) {
      const infoData = (await infoRes.json()) as { response?: { user?: { name?: string; blogs?: Array<{ name?: string; primary?: boolean }> } } }
      const user = infoData.response?.user
      username = user?.name ?? 'tumblr-user'
      const primaryBlog = user?.blogs?.find((b) => b.primary) ?? user?.blogs?.[0]
      blogIdentifier = primaryBlog?.name ? `${primaryBlog.name}.tumblr.com` : username
    }

    const creds: Record<string, string> = {
      consumer_key: consumerKey,
      consumer_secret: process.env[entry.oauth1!.consumerSecretEnvVar] ?? '',
      oauth_token: result.oauth_token,
      oauth_token_secret: result.oauth_token_secret,
      blog_identifier: blogIdentifier || username,
    }

    await prisma.platformAccount.upsert({
      where: { platform_username: { platform, username } } as never,
      create: { platform, username, credentialsEncrypted: encryptCredential(JSON.stringify(creds)), isActive: true },
      update: { credentialsEncrypted: encryptCredential(JSON.stringify(creds)), isActive: true, lastUsedAt: new Date() },
    })

    return popupPage(true, platform, username)
  }

  // ── OAuth2 ───────────────────────────────────────────────────────────────────
  if (!code) return popupPage(false, platform, '', 'No authorization code received')

  // CSRF check (skip for development where state may not match cookie exactly)
  if (cookieState && queryState) {
    const verified = verifyState(cookieState, queryState)
    if (!verified) return popupPage(false, platform, '', 'Invalid state — possible CSRF. Please try again.')
  }

  const tokenResult = await oauth2Exchange(platform, code, cookiePkce || null)
  if ('error' in tokenResult) return popupPage(false, platform, '', tokenResult.error)

  const { access_token, refresh_token, expires_in } = tokenResult

  // Call verifier to get username + metadata (blog_id, etc.)
  const creds: Record<string, string> = { access_token }
  if (refresh_token) creds.refresh_token = refresh_token

  const verifyResult = await entry.verify(creds)

  // Merge auto-discovered metadata (blog_id, publication_id, etc.)
  for (const [k, v] of Object.entries(verifyResult.metadata ?? {})) {
    if (!['publication_title', 'blog_url', 'available_blogs'].includes(k)) {
      creds[k] = v
    }
  }

  const username = verifyResult.username ?? platform

  const tokenExpiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null

  try {
    // Upsert by platform (one account per platform for simplicity)
    const existing = await prisma.platformAccount.findFirst({ where: { platform } })
    const encrypted = encryptCredential(JSON.stringify(creds))

    if (existing) {
      await prisma.platformAccount.update({
        where: { id: existing.id },
        data: {
          username,
          credentialsEncrypted: encrypted,
          isActive: true,
          tokenExpiresAt: tokenExpiresAt ?? undefined,
          lastUsedAt: new Date(),
        },
      })
    } else {
      await prisma.platformAccount.create({
        data: {
          platform,
          username,
          credentialsEncrypted: encrypted,
          isActive: true,
          tokenExpiresAt: tokenExpiresAt ?? undefined,
        },
      })
    }
  } catch (e) {
    return popupPage(false, platform, '', `DB error: ${(e as Error).message}`)
  }

  return popupPage(true, platform, username)
}
