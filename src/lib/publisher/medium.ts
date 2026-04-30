/**
 * Medium publisher
 *
 * API: Medium API v1 (Integration Token) — official
 *   OR Medium internal API with cookie session — fallback for accounts without API tokens
 * Docs: https://github.com/Medium/medium-api-docs
 *
 * NOTE: Medium stopped issuing new integration tokens for new accounts circa 2023,
 * but existing tokens continue to work. Cookie-based auth is used as a fallback.
 */

export interface MediumPublishInput {
  integrationToken?: string
  cookieSession?: string  // cookie_auth or cookie_session from stored credentials
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
async function getMediumUserIdByToken(integrationToken: string): Promise<string> {
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

/** Resolve Medium user ID via cookie session (internal API). */
async function getMediumUserIdByCookie(cookieSession: string): Promise<string> {
  const res = await fetch('https://medium.com/_/api/users/self', {
    headers: {
      Cookie: cookieSession,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    },
  })
  if (!res.ok) throw new Error(`Medium session invalid (${res.status})`)
  const text = await res.text()
  const cleaned = text.replace(/^\]\)\}[^\n]*\n/, '')
  const json = JSON.parse(cleaned) as { payload?: { user?: { id?: string } } }
  const userId = json?.payload?.user?.id
  if (!userId) throw new Error('Medium: session valid but no user ID returned')
  return userId
}

export async function publishToMedium(
  input: MediumPublishInput
): Promise<MediumPublishResult> {
  const tags = input.tags
    .slice(0, 5)
    .map((t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim())
    .filter(Boolean)

  // Path 1: Official integration token
  if (input.integrationToken) {
    const userId = await getMediumUserIdByToken(input.integrationToken)

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

  // Path 2: Cookie-based session (internal API)
  if (input.cookieSession) {
    const userId = await getMediumUserIdByCookie(input.cookieSession)

    const res = await fetch('https://medium.com/_/api/posts', {
      method: 'POST',
      headers: {
        Cookie: input.cookieSession,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://medium.com/new-story',
      },
      body: JSON.stringify({
        title: input.title,
        content: { bodyModel: { paragraphs: [], sections: [] } },
        contentFormat: 'html',
        canonicalUrl: input.canonicalUrl,
        tags: tags.map(t => ({ slug: t, name: t })),
        publishStatus: input.publishStatus === 'draft' ? 0 : input.publishStatus === 'unlisted' ? 2 : 1,
        authorId: userId,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Medium cookie-publish failed (${res.status}): ${text}`)
    }

    const text = await res.text()
    const cleaned = text.replace(/^\]\)\}[^\n]*\n/, '')
    const data = JSON.parse(cleaned) as { payload?: { post?: { id?: string; uniqueSlug?: string } } }
    const post = data?.payload?.post
    const postId = post?.id
    if (!postId) throw new Error('Medium: cookie publish succeeded but no post ID returned')
    const url = `https://medium.com/p/${post?.uniqueSlug ?? postId}`
    return { url, postId }
  }

  throw new Error('Medium: integration_token or cookie_session is required')
}
