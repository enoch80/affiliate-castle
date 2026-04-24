/**
 * Tumblr publisher
 *
 * API: Tumblr API v2
 * Auth: OAuth 1.0a — we use the simpler API key + token approach
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

/** Minimal OAuth 1.0a signature for Tumblr API calls */
function buildOAuthHeader(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerKey: string,
  consumerSecret: string,
  oauthToken: string,
  oauthTokenSecret: string
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: oauthToken,
    oauth_version: '1.0',
  }

  const allParams = { ...params, ...oauthParams }
  const sortedKeys = Object.keys(allParams).sort()
  const paramString = sortedKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join('&')

  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(paramString),
  ].join('&')

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(oauthTokenSecret)}`
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64')

  oauthParams['oauth_signature'] = signature

  const headerParts = Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(', ')

  return `OAuth ${headerParts}`
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
