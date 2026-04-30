/**
 * Tumblr publisher
 *
 * API: Tumblr API v2
 * Auth: OAuth 1.0a (RFC 5849) — HMAC-SHA1 signed requests
 * Docs: https://www.tumblr.com/docs/en/api/v2#posts
 *
 * Tumblr has no affiliate link restrictions — publishes short-form HTML posts.
 */
import crypto from 'crypto'

export interface TumblrPublishInput {
  consumerKey: string
  consumerSecret: string
  oauthToken: string
  oauthTokenSecret: string
  blogIdentifier: string   // e.g. "myblog.tumblr.com"
  title: string
  contentHtml: string      // ~400–600 words
  tags: string[]
}

export interface TumblrPublishResult {
  url: string
  postId: number
}

// RFC 5849 §3.6 — percent-encode per OAuth spec (encodeURIComponent + unreserved extras)
function pct(value: string): string {
  return encodeURIComponent(value)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
}

// RFC 5849 §3.4.1.1 — build the normalised parameter string
// All request + oauth params, sorted lexicographically by encoded key then encoded value
function buildParamString(requestParams: Record<string, string>, oauthFields: [string, string][]): string {
  // Merge into a flat list of [encodedKey, encodedValue] pairs
  const pairs: [string, string][] = [
    ...Object.entries(requestParams).map(([k, v]): [string, string] => [pct(k), pct(v)]),
    ...oauthFields.map(([k, v]): [string, string] => [pct(k), pct(v)]),
  ]
  // Sort: primary by key, secondary by value (per spec)
  pairs.sort(([ka, va], [kb, vb]) => {
    if (ka < kb) return -1
    if (ka > kb) return 1
    return va < vb ? -1 : va > vb ? 1 : 0
  })
  return pairs.map(([k, v]) => `${k}=${v}`).join('&')
}

// RFC 5849 §3.4.2 — HMAC-SHA1 signing key = pct(secret)&pct(tokenSecret)
function signingKey(consumerSecret: string, tokenSecret: string): string {
  return `${pct(consumerSecret)}&${pct(tokenSecret)}`
}

// RFC 5849 §3.4.1 — signature base string = METHOD&pct(baseUrl)&pct(paramString)
function signatureBaseString(method: string, baseUrl: string, normalisedParams: string): string {
  return `${method.toUpperCase()}&${pct(baseUrl)}&${pct(normalisedParams)}`
}

/**
 * Build the OAuth Authorization header for a Tumblr API request.
 * Implements RFC 5849 OAuth 1.0a with HMAC-SHA1 signature method.
 */
function buildOAuthHeader(
  httpMethod: string,
  requestUrl: string,
  bodyParams: Record<string, string>,
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessTokenSecret: string
): string {
  // Generate fresh nonce + timestamp for each request (replay attack prevention)
  const nonce = crypto.randomBytes(18).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)
  const timestamp = String(Math.floor(Date.now() / 1000))

  // OAuth protocol fields (excludes oauth_signature — added after signing)
  const oauthFields: [string, string][] = [
    ['oauth_consumer_key', consumerKey],
    ['oauth_nonce', nonce],
    ['oauth_signature_method', 'HMAC-SHA1'],
    ['oauth_timestamp', timestamp],
    ['oauth_token', accessToken],
    ['oauth_version', '1.0'],
  ]

  // Compute signature
  const paramString = buildParamString(bodyParams, oauthFields)
  const baseStr = signatureBaseString(httpMethod, requestUrl, paramString)
  const key = signingKey(consumerSecret, accessTokenSecret)
  const signature = crypto.createHmac('sha1', key).update(baseStr).digest('base64')

  // Build Authorization header value — only oauth_ fields go in header (not body params)
  const headerFields: [string, string][] = [...oauthFields, ['oauth_signature', signature]]
  const headerValue = headerFields
    .map(([k, v]) => `${pct(k)}="${pct(v)}"`)
    .join(', ')

  return `OAuth ${headerValue}`
}

export async function publishToTumblr(
  input: TumblrPublishInput
): Promise<TumblrPublishResult> {
  const apiUrl = `https://api.tumblr.com/v2/blog/${input.blogIdentifier}/post`
  const postParams: Record<string, string> = {
    type: 'text',
    title: input.title,
    body: input.contentHtml,
    tags: input.tags.slice(0, 10).join(','),
    format: 'html',
    native_inline_images: 'false',
  }

  const oauthHeader = buildOAuthHeader(
    'POST',
    apiUrl,
    postParams,
    input.consumerKey,
    input.consumerSecret,
    input.oauthToken,
    input.oauthTokenSecret
  )

  const formBody = new URLSearchParams(postParams).toString()

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: oauthHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Tumblr publish failed (${response.status}): ${text}`)
  }

  const data = await response.json() as { response?: { id: number; id_string?: string } }
  const postId = data.response?.id ?? 0
  const url = `https://${input.blogIdentifier}/post/${postId}`

  return { url, postId }
}
