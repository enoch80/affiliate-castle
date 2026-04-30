/**
 * GET /api/auth/oauth/start?platform=X
 *
 * Initiates the OAuth flow for a platform:
 *   - oauth2:  returns { url, authType:'oauth2' }  → client opens popup
 *   - oauth1:  server fetches request token from Tumblr, returns { url, authType:'oauth1' }
 *   - manual_token: returns { authType:'manual_token' } → client shows paste form
 *
 * State is signed as a JWT (via NEXTAUTH_SECRET) and stored in an
 * HTTP-only SameSite=Lax cookie so the callback can verify CSRF.
 *
 * PKCE: for platforms with pkce:true a code_verifier is generated,
 * its SHA-256 challenge stored in cookie, and code_challenge sent to
 * the authorization URL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import crypto from 'crypto'
import { authOptions } from '@/lib/auth'
import { getPlatform } from '@/lib/platform-registry'
import { buildOAuth1Header } from '@/lib/oauth1'

const REDIRECT_URI = `${process.env.NEXTAUTH_URL ?? ''}/api/auth/oauth/callback`

function signState(payload: Record<string, string>): string {
  const secret = process.env.NEXTAUTH_SECRET ?? 'dev-secret'
  const json = JSON.stringify({ ...payload, iat: Date.now() })
  const hmac = crypto.createHmac('sha256', secret).update(json).digest('base64url')
  return `${Buffer.from(json).toString('base64url')}.${hmac}`
}

function pkceVerifier(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(40).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

/** Tumblr OAuth1 request token (server-side) */
async function tumblrRequestToken(callbackUrl: string): Promise<{ token: string; tokenSecret: string }> {
  const consumerKey = process.env.TUMBLR_CONSUMER_KEY ?? ''
  const consumerSecret = process.env.TUMBLR_CONSUMER_SECRET ?? ''
  if (!consumerKey || !consumerSecret) throw new Error('TUMBLR_CONSUMER_KEY / TUMBLR_CONSUMER_SECRET not set')

  const requestTokenUrl = 'https://www.tumblr.com/oauth/request_token'

  // RFC 5849 §3.1 — request_token step: no token yet, oauth_callback in protocol fields
  const authHeader = buildOAuth1Header({
    method: 'POST',
    url: requestTokenUrl,
    consumerKey,
    consumerSecret,
    extraFields: [['oauth_callback', callbackUrl]],
  })

  const res = await fetch(requestTokenUrl, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  if (!res.ok) throw new Error(`Tumblr request_token failed: HTTP ${res.status}`)

  const body = await res.text()
  const p = new URLSearchParams(body)
  const token = p.get('oauth_token')
  const tokenSecret = p.get('oauth_token_secret')
  if (!token || !tokenSecret) throw new Error('Tumblr did not return oauth_token/secret')
  return { token, tokenSecret }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const platform = req.nextUrl.searchParams.get('platform')
  if (!platform) return NextResponse.json({ error: 'platform param required' }, { status: 400 })

  let entry
  try { entry = getPlatform(platform) } catch {
    return NextResponse.json({ error: `Unknown platform: ${platform}` }, { status: 400 })
  }

  // ── Manual token — nothing to start ─────────────────────────────────────────
  if (entry.authType === 'manual_token') {
    return NextResponse.json({ authType: 'manual_token' })
  }

  const statePayload: Record<string, string> = { platform, nonce: crypto.randomBytes(16).toString('hex') }
  const headers = new Headers({ 'Content-Type': 'application/json' })

  // ── OAuth1 (Tumblr) ──────────────────────────────────────────────────────────
  if (entry.authType === 'oauth1') {
    try {
      const callbackUrl = `${REDIRECT_URI}?platform=${platform}`
      const { token, tokenSecret } = await tumblrRequestToken(callbackUrl)
      statePayload.oauth1_token = token
      const state = signState(statePayload)
      // Store token_secret + state in cookies (HTTP-only, SameSite=Lax, 10 min TTL)
      headers.append('Set-Cookie', `oauth_tmp_secret=${encodeURIComponent(tokenSecret)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`)
      headers.append('Set-Cookie', `oauth_state=${encodeURIComponent(state)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`)
      const url = `${entry.oauth1!.authorizeUrl}?oauth_token=${token}`
      return NextResponse.json({ authType: 'oauth1', url }, { headers })
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
  }

  // ── OAuth2 ───────────────────────────────────────────────────────────────────
  const cfg = entry.oauth2!
  const clientId = process.env[cfg.clientIdEnvVar]
  if (!clientId) {
    return NextResponse.json({ error: `${cfg.clientIdEnvVar} is not set — add it to server .env and restart` }, { status: 500 })
  }

  const params: Record<string, string> = {
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: cfg.scopes.join(' '),
    ...cfg.extraParams,
  }

  let pkceVerifierValue: string | undefined
  if (cfg.pkce) {
    const { verifier, challenge } = pkceVerifier()
    pkceVerifierValue = verifier
    params.code_challenge = challenge
    params.code_challenge_method = 'S256'
  }

  const state = signState(statePayload)
  params.state = state

  const url = `${cfg.authorizationUrl}?${new URLSearchParams(params).toString()}`

  headers.append('Set-Cookie', `oauth_state=${encodeURIComponent(state)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`)
  if (pkceVerifierValue) {
    headers.append('Set-Cookie', `oauth_pkce=${encodeURIComponent(pkceVerifierValue)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`)
  }

  return NextResponse.json({ authType: 'oauth2', url }, { headers })
}
