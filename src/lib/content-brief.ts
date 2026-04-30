/**
 * Content Brief Generator — Sprint 3
 * Generates a structured content brief JSON from:
 * - Offer / market research data
 * - Semantic gap analysis results
 *
 * The brief drives all downstream LLM content generation (Sprint 4).
 */

import type { SemanticGapAnalysis } from './semantic-gap'

export interface ContentBrief {
  /** Unique campaign identifier */
  campaignId: string
  /** ISO timestamp */
  generatedAt: string

  // ─── Target keyword & SEO ──────────────────────────────────────────────────
  primaryKeyword: string
  secondaryKeywords: string[]
  titleFormula: string
  /** 50–60 char SEO title suggestion */
  proposedTitle: string
  /** 150–160 char meta description */
  proposedMetaDescription: string

  // ─── Audience & positioning ────────────────────────────────────────────────
  targetAudience: string[]
  painPoints: string[]
  benefits: string[]
  angle: string

  // ─── Structure ─────────────────────────────────────────────────────────────
  targetWordCount: number
  avgCompetitorWordCount: number
  suggestedOutline: ContentBriefSection[]

  // ─── NLP requirements ──────────────────────────────────────────────────────
  mandatoryEntities: string[]
  recommendedEntities: string[]
  lsiTerms: string[]

  // ─── FAQ ───────────────────────────────────────────────────────────────────
  faqQuestions: string[]

  // ─── Bridge page CTA ───────────────────────────────────────────────────────
  ctaSuggestion: string
  offerUrl: string

  // ─── Competitive context ───────────────────────────────────────────────────
  competitorUrls: string[]

  // ─── Sprint B new fields ───────────────────────────────────────────────────
  /** kebab-case URL slug derived from primaryKeyword (max 5 words, stop-words removed) */
  urlSlug: string
  /** JSON-LD schema type for this content */
  schemaType: 'Article' | 'HowTo' | 'FAQPage'
  /** Detected search intent */
  searchIntent: 'informational' | 'commercial' | 'transactional'
  /** Estimated reading time in minutes (targetWordCount / 200) */
  readingTimeMinutes: number
  /** Pinterest-friendly keyword variants for pin descriptions */
  pinterestKeywords: string[]
}

export interface ContentBriefSection {
  level: 'h1' | 'h2' | 'h3'
  text: string
  notes: string
  targetWords?: number
}

/** Build a content brief from gap analysis + offer research data */
export function generateContentBrief(params: {
  campaignId: string
  primaryKeyword: string
  secondaryKeywords: string[]
  angle: string
  targetAudience: string[]
  painPoints: string[]
  benefits: string[]
  productName: string
  hoplink: string
  gap: SemanticGapAnalysis
}): ContentBrief {
  const {
    campaignId,
    primaryKeyword,
    secondaryKeywords,
    angle,
    targetAudience,
    painPoints,
    benefits,
    productName,
    hoplink,
    gap,
  } = params

  const kw = primaryKeyword || productName

  // Title formula selection (based on pain/benefit presence)
  const titleFormula = painPoints.length
    ? `How to [benefit] without [biggest pain point] — [year]`
    : `[Number] Ways to [primary keyword] — Complete Guide [year]`

  const currentYear = new Date().getFullYear()
  const proposedTitle = truncate(
    `How to ${capitalize(kw)} — The Complete ${currentYear} Guide`,
    60,
  )

  const mainBenefit = benefits[0] || `achieve results with ${kw}`
  const proposedMetaDescription = truncate(
    `Discover how to ${kw} in ${currentYear}. ${mainBenefit}. Free guide inside.`,
    160,
  )

  // Build suggested outline
  const outline: ContentBriefSection[] = [
    {
      level: 'h1',
      text: proposedTitle,
      notes: 'Must contain primary keyword in first 60 characters',
      targetWords: 150,
    },
    {
      level: 'h2',
      text: `What Is ${capitalize(kw)} and Why It Matters`,
      notes: 'Definition + problem context. Include primary keyword in first 100 words.',
      targetWords: 300,
    },
  ]

  // Add required headings from gap analysis
  gap.requiredHeadings.slice(0, 4).forEach((h) => {
    outline.push({
      level: 'h2',
      text: capitalize(h),
      notes: `Present in ${Math.round(gap.competitorUrls.length / 2)}+ competitor pages — required`,
      targetWords: 400,
    })
  })

  // Add gap section (differentiator)
  outline.push({
    level: 'h2',
    text: `The ${capitalize(kw)} Mistake Most People Make`,
    notes: 'Differentiator section — unique insight not found in competitors',
    targetWords: 350,
  })

  // FAQ section
  if (gap.faqQuestions.length) {
    outline.push({
      level: 'h2',
      text: 'Frequently Asked Questions',
      notes: `Cover ${Math.min(gap.faqQuestions.length, 8)} FAQ questions. Use FAQ schema markup.`,
      targetWords: Math.min(gap.faqQuestions.length, 8) * 80,
    })
  }

  // Conclusion + bridge CTA
  outline.push({
    level: 'h2',
    text: 'Conclusion and Next Steps',
    notes: `Soft CTA to bridge page. Mention ${productName}.`,
    targetWords: 100,
  })

  const ctaSuggestion = `Ready to ${kw}? Get our free guide and learn the fastest path to results →`

  const urlSlug = generateSlug(primaryKeyword || productName)
  const schemaType = selectSchemaType(primaryKeyword || productName, gap.faqQuestions.length)
  const searchIntent = detectSearchIntent(primaryKeyword || productName)
  const readingTimeMinutes = Math.max(1, Math.round((gap.targetWordCount || 1850) / 200))
  const pinterestKeywords = buildPinterestKeywords(primaryKeyword || productName, secondaryKeywords)

  return {
    campaignId,
    generatedAt: new Date().toISOString(),
    primaryKeyword: kw,
    secondaryKeywords,
    titleFormula,
    proposedTitle,
    proposedMetaDescription,
    targetAudience,
    painPoints,
    benefits,
    angle,
    targetWordCount: gap.targetWordCount,
    avgCompetitorWordCount: gap.avgWordCount,
    suggestedOutline: outline,
    mandatoryEntities: gap.mandatoryEntities,
    recommendedEntities: gap.recommendedEntities,
    lsiTerms: gap.lsiTerms,
    faqQuestions: gap.faqQuestions,
    ctaSuggestion,
    offerUrl: hoplink,
    competitorUrls: gap.competitorUrls,
    urlSlug,
    schemaType,
    searchIntent,
    readingTimeMinutes,
    pinterestKeywords,
  }
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
])

function generateSlug(keyword: string): string {
  return keyword
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => !STOP_WORDS.has(w) && w.length > 0)
    .slice(0, 5)
    .join('-')
}

function selectSchemaType(
  keyword: string,
  faqCount: number,
): 'Article' | 'HowTo' | 'FAQPage' {
  if (/^how to\b/i.test(keyword)) return 'HowTo'
  if (faqCount >= 4) return 'FAQPage'
  return 'Article'
}

function detectSearchIntent(
  keyword: string,
): 'informational' | 'commercial' | 'transactional' {
  const lower = keyword.toLowerCase()
  if (/\b(buy|price|discount|coupon|deal|order)\b/.test(lower)) return 'transactional'
  if (/\b(best|top|review|vs|compare|worth it)\b/.test(lower)) return 'commercial'
  return 'informational'
}

function buildPinterestKeywords(primary: string, secondary: string[]): string[] {
  const base = primary.toLowerCase()
  const variants = [
    base,
    `${base} for beginners`,
    `${base} tips`,
    `${base} guide`,
    `learn ${base}`,
    ...secondary.slice(0, 3).map((s) => s.toLowerCase()),
  ]
  return Array.from(new Set(variants)).slice(0, 8)
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max - 3) + '...'
}

function capitalize(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// §12.2 — Dynamic competitor word count (async, for pipeline use)
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url: string, ms: number): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fetch up to 5 SERP competitor pages, strip HTML, count their words, and
 * return the median + 200 (floor 1,500).  Falls back to 1,850 on any error.
 */
export async function getCompetitorWordCount(serpUrls: string[]): Promise<number> {
  const counts: number[] = []
  for (const url of serpUrls.slice(0, 5)) {
    try {
      const html = await fetchWithTimeout(url, 6000)
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
      counts.push(text.trim().split(' ').length)
    } catch {
      // skip unreachable URLs
    }
  }
  if (counts.length === 0) return 1850
  const sorted = counts.sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  return Math.max(median + 200, 1500)
}
