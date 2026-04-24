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
  }
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max - 3) + '...'
}

function capitalize(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase())
}
