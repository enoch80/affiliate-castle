/**
 * Hashnode publisher
 *
 * API: GraphQL at https://gql.hashnode.com
 * Auth: Authorization header with Personal Access Token
 * Canonical URL = bridge page URL
 */

const HASHNODE_GQL = 'https://gql.hashnode.com'

export interface HashnodePublishInput {
  apiToken: string
  publicationId: string   // Hashnode publication/blog ID
  title: string
  contentMarkdown: string
  tags: string[]          // Hashnode tag slugs (up to 5)
  canonicalUrl: string
  description: string
}

export interface HashnodePublishResult {
  url: string
  postId: string
}

export async function publishToHashnode(
  input: HashnodePublishInput
): Promise<HashnodePublishResult> {
  const tagObjects = input.tags.slice(0, 5).map((slug) => ({
    slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    name: slug,
  }))

  const mutation = `
    mutation PublishPost($input: PublishPostInput!) {
      publishPost(input: $input) {
        post {
          id
          url
        }
      }
    }
  `

  const variables = {
    input: {
      title: input.title,
      contentMarkdown: input.contentMarkdown,
      publicationId: input.publicationId,
      tags: tagObjects,
      originalArticleURL: input.canonicalUrl,
      metaTags: {
        title: input.title,
        description: input.description.slice(0, 160),
      },
    },
  }

  const response = await fetch(HASHNODE_GQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: input.apiToken,
    },
    body: JSON.stringify({ query: mutation, variables }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Hashnode publish failed (${response.status}): ${text}`)
  }

  const data = await response.json() as {
    data?: { publishPost?: { post?: { id: string; url: string } } }
    errors?: Array<{ message: string }>
  }

  if (data.errors?.length) {
    throw new Error(`Hashnode GraphQL errors: ${data.errors.map((e) => e.message).join(', ')}`)
  }

  const post = data.data?.publishPost?.post
  if (!post) {
    throw new Error('Hashnode: no post returned from publishPost')
  }

  return { url: post.url, postId: post.id }
}
