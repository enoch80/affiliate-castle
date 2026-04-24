/**
 * Blogger publisher
 *
 * API: Google Blogger API v3
 * Auth: OAuth2 access token
 * Docs: https://developers.google.com/blogger/docs/3.0/reference/posts/insert
 */

export interface BloggerPublishInput {
  accessToken: string
  blogId: string
  title: string
  contentHtml: string
  labels: string[]   // Up to 20 tags/labels
  canonicalUrl: string
}

export interface BloggerPublishResult {
  url: string
  postId: string
}

export async function publishToBlogger(
  input: BloggerPublishInput
): Promise<BloggerPublishResult> {
  const labels = input.labels.slice(0, 20)

  const response = await fetch(
    `https://www.googleapis.com/blogger/v3/blogs/${input.blogId}/posts/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.accessToken}`,
      },
      body: JSON.stringify({
        kind: 'blogger#post',
        title: input.title,
        content: input.contentHtml,
        labels,
      }),
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Blogger publish failed (${response.status}): ${text}`)
  }

  const data = await response.json() as { url: string; id: string }
  return { url: data.url, postId: data.id }
}
