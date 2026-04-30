/**
 * Schema Generator — Sprint C
 *
 * Builds JSON-LD structured data objects for all content types.
 * Functions return plain objects (not strings); use wrapSchemaTag() to
 * produce the final <script type="application/ld+json"> tag.
 *
 * Spec reference: §4.6
 */

// ---------------------------------------------------------------------------
// Param interfaces
// ---------------------------------------------------------------------------

export interface ArticleSchemaParams {
  title: string
  url: string
  datePublished: string   // ISO 8601
  description: string
  authorName: string
  dateModified?: string
  imageUrl?: string
  wordCount?: number
  keywords?: string[]
  publisherName?: string
  publisherLogoUrl?: string
}

export interface HowToSchemaParams {
  name: string
  description: string
  url: string
  steps: { name: string; text: string }[]
  imageUrl?: string
  /** ISO 8601 duration, e.g. "PT30M" */
  totalTime?: string
}

export interface FAQSchemaItem {
  question: string
  answer: string
}

export interface BreadcrumbSchemaParams {
  /** Ordered list: [Home, Niche, Article] */
  items: { name: string; url: string }[]
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/** Article JSON-LD. Headline is capped at 110 chars per Google spec. */
export function buildArticleSchema(params: ArticleSchemaParams): Record<string, unknown> {
  const headline =
    params.title.length > 110 ? params.title.slice(0, 107) + '...' : params.title

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    url: params.url,
    description: params.description,
    datePublished: params.datePublished,
    dateModified: params.dateModified ?? params.datePublished,
    author: {
      '@type': 'Person',
      name: params.authorName,
    },
    publisher: {
      '@type': 'Organization',
      name: params.publisherName ?? 'AffiliateCastle',
      logo: {
        '@type': 'ImageObject',
        url: params.publisherLogoUrl ?? 'https://app.digitalfinds.net/img/logo.png',
      },
    },
  }

  if (params.imageUrl) schema.image = params.imageUrl
  if (params.wordCount) schema.wordCount = params.wordCount
  if (params.keywords?.length) schema.keywords = params.keywords.join(', ')

  return schema
}

/** HowTo JSON-LD for procedural "how to" content. */
export function buildHowToSchema(params: HowToSchemaParams): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: params.name,
    description: params.description,
    url: params.url,
    step: params.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  }

  if (params.imageUrl) schema.image = params.imageUrl
  if (params.totalTime) schema.totalTime = params.totalTime

  return schema
}

/** FAQPage JSON-LD. Answers are capped at 300 chars per Google spec. */
export function buildFAQSchema(faqs: FAQSchemaItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer.length > 300 ? answer.slice(0, 297) + '...' : answer,
      },
    })),
  }
}

/** BreadcrumbList JSON-LD. Typical 3-level: Home → Niche → Article. */
export function buildBreadcrumbSchema(
  params: BreadcrumbSchemaParams,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: params.items.map(({ name, url }, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: url,
    })),
  }
}

/** Wrap a schema object in a <script type="application/ld+json"> tag. */
export function wrapSchemaTag(schemaObj: Record<string, unknown>): string {
  return (
    '<script type="application/ld+json">\n' +
    JSON.stringify(schemaObj, null, 2) +
    '\n</script>'
  )
}

/** Build and inject all relevant schema tags into an HTML string. */
export function injectSchemaIntoHtml(
  html: string,
  schemas: Record<string, unknown>[],
): string {
  const tags = schemas.map(wrapSchemaTag).join('\n')
  // Inject before </head> if present, otherwise prepend
  if (html.includes('</head>')) {
    return html.replace('</head>', `${tags}\n</head>`)
  }
  return tags + '\n' + html
}
