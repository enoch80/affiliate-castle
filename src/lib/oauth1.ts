/**
 * OAuth 1.0a protocol helpers (RFC 5849)
 *
 * Provides HMAC-SHA1 request signing used in the Tumblr OAuth 1.0 three-legged flow.
 * Shared by:
 *   - src/app/api/auth/oauth/start/route.ts   (request_token step)
 *   - src/app/api/auth/oauth/callback/route.ts (access_token step)
 *
 * RFC 5849 sections are cited inline so the algorithm is self-documenting.
 */

import crypto from 'crypto'

// RFC 5849 §3.6 — percent-encode per OAuth spec
// Extends encodeURIComponent with the five additional unreserved-character replacements
export function pct(value: string): string {
  return encodeURIComponent(value)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
}

// RFC 5849 §3.4.1.1 — normalised request parameter string
// Merges POST-body params + oauth protocol fields, sorts lexicographically, joins with '&'
export function buildParamString(
  bodyParams: Record<string, string>,
  oauthFields: Array<[string, string]>
): string {
  const pairs: Array<[string, string]> = [
    ...Object.entries(bodyParams).map(([k, v]): [string, string] => [pct(k), pct(v)]),
    ...oauthFields.map(([k, v]): [string, string] => [pct(k), pct(v)]),
  ]
  // Primary sort by encoded key; secondary sort by encoded value (per spec)
  pairs.sort(([ka, va], [kb, vb]) => {
    if (ka < kb) return -1
    if (ka > kb) return 1
    return va < vb ? -1 : va > vb ? 1 : 0
  })
  return pairs.map(([k, v]) => `${k}=${v}`).join('&')
}

// RFC 5849 §3.4.2 — HMAC-SHA1 signing key = pct(consumerSecret)&pct(tokenSecret)
// tokenSecret is the empty string during the request_token step (no token issued yet)
export function signingKey(consumerSecret: string, tokenSecret: string): string {
  return `${pct(consumerSecret)}&${pct(tokenSecret)}`
}

// RFC 5849 §3.4.1 — signature base string = METHOD&pct(baseUrl)&pct(normalisedParams)
export function signatureBaseString(method: string, url: string, normParams: string): string {
  return `${method.toUpperCase()}&${pct(url)}&${pct(normParams)}`
}

export interface OAuth1SignOptions {
  method: string
  url: string
  /** POST body params — empty for Tumblr request_token and access_token calls */
  bodyParams?: Record<string, string>
  consumerKey: string
  consumerSecret: string
  /** oauth_token — omit on the request_token step (not yet issued) */
  tokenKey?: string
  /** oauth_token_secret — omit on the request_token step */
  tokenSecret?: string
  /**
   * Step-specific protocol fields appended to the oauth parameter set:
   *   request_token step: [['oauth_callback', callbackUrl]]
   *   access_token step:  [['oauth_verifier', verifierCode]]
   */
  extraFields?: Array<[string, string]>
}

/**
 * Build a signed OAuth 1.0a Authorization header value for a single HTTP request.
 * The returned string is ready to be passed as the Authorization header.
 */
export function buildOAuth1Header(opts: OAuth1SignOptions): string {
  const nonce = crypto.randomBytes(18).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)
  const timestamp = String(Math.floor(Date.now() / 1000))

  // Core OAuth protocol fields — these always appear in every signed request
  const coreFields: Array<[string, string]> = [
    ['oauth_consumer_key', opts.consumerKey],
    ['oauth_nonce', nonce],
    ['oauth_signature_method', 'HMAC-SHA1'],
    ['oauth_timestamp', timestamp],
    ['oauth_version', '1.0'],
    ...(opts.tokenKey ? [['oauth_token', opts.tokenKey] as [string, string]] : []),
    ...(opts.extraFields ?? []),
  ]

  const paramStr = buildParamString(opts.bodyParams ?? {}, coreFields)
  const baseStr = signatureBaseString(opts.method, opts.url, paramStr)
  const key = signingKey(opts.consumerSecret, opts.tokenSecret ?? '')
  const signature = crypto.createHmac('sha1', key).update(baseStr).digest('base64')

  const allFields: Array<[string, string]> = [...coreFields, ['oauth_signature', signature]]

  return 'OAuth ' + allFields.map(([k, v]) => `${pct(k)}="${pct(v)}"`).join(', ')
}
