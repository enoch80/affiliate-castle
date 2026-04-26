/**
 * Medium publisher
 *
 * API: Medium API v1 (Integration Token)
 * Auth: Authorization: Bearer <integration_token>
 * Docs: https://github.com/Medium/medium-api-docs
 *
 * Flow:
 *   1. GET /v1/me            → resolve authorId
 *   2. POST /v1/users/:id/posts → publish
 *
 * NOTE: Medium stopped issuing new integration tokens for new accounts circa 2023,
 * but existing tokens continue to work.
 */

export interface MediumPublishInput {
  integrationToken: string
  title: string
  contentHtml: string
  tags: string[]
  canonicalUrl: string
  publishStatus?: 'public' | 'draft' | 'unlisted'
  notifyFollowers?: boolean
}

export interface MediumPublishResult {
  url: string
  postId: string
}

/** Resolve Medium user ID from an integration token. */
async function getMediumUserId(integrationToken: string): Promise<string> {
  const res = await fetch('https://api.medium.com/v1/me', {
    headers: {
      Authorization: `Bearer ${integrationToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Medium auth failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as { data?: { id?: string } }
  const userId = data?.data?.id
  if (!userId) throw new Error('Medium: could not resolve user ID from token')
  return userId
}

export async function publishToMedium(
  input: MediumPublishInput
): Promise<MediumPublishResult> {
  const userId = await getMediumUserId(input.integrationToken)

  const tags = input.tags
    .slice(0, 5)
    .map((t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim())
    .filter(Boolean)

  const res = await fetch(`https://api.medium.com/v1/users/${userId}/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.integrationToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: input.title,
      contentFormat: 'html',
      content: input.contentHtml,
      tags,
      canonicalUrl: input.canonicalUrl,
      publishStatus: input.publishStatus ?? 'public',
      notifyFollowers: input.notifyFollowers ?? true,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Medium publish failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as { data?: { id?: string; url?: string } }
  const post = data?.data
  if (!post?.url || !post?.id) throw new Error('Medium: publish succeeded but no URL returned')

  return { url: post.url, postId: post.id }
}
