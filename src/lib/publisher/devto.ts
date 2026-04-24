/**
 * dev.to publisher
 *
 * API docs: https://developers.forem.com/api
 * Auth: X-API-Key header
 * Canonical URL = bridge page URL (so SEO credit flows to our page)
 */

export interface DevtoPublishInput {
  apiKey: string
  title: string
  bodyMarkdown: string
  tags: string[]
  canonicalUrl: string
  description: string
}

export interface DevtoPublishResult {
  url: string
  articleId: number
}

export async function publishToDevto(
  input: DevtoPublishInput
): Promise<DevtoPublishResult> {
  const tags = input.tags.slice(0, 4).map((t) =>
    t.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30)
  )

  const response = await fetch('https://dev.to/api/articles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': input.apiKey,
    },
    body: JSON.stringify({
      article: {
        title: input.title,
        body_markdown: input.bodyMarkdown,
        published: true,
        tags,
        canonical_url: input.canonicalUrl,
        description: input.description.slice(0, 160),
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`dev.to publish failed (${response.status}): ${text}`)
  }

  const data = await response.json() as { url: string; id: number }
  return { url: data.url, articleId: data.id }
}
