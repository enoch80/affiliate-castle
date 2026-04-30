/**
 * Internal Linker — Sprint C
 *
 * Injects contextually-relevant internal links into article HTML using Jaccard
 * similarity between section headings and sibling campaign keywords.
 *
 * Algorithm (§4.8):
 *  1. Query last 10 published campaigns in same niche (exclude current)
 *  2. Filter to those with at least one published URL
 *  3. Pick 2 most recent
 *  4. Derive anchor text from sibling's primaryKeyword (max 8 words)
 *  5. Find best H2 section using Jaccard similarity
 *  6. Inject link at end of second paragraph after that H2
 *
 * Spec reference: §4.8
 */

import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Jaccard similarity
// ---------------------------------------------------------------------------

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(
    a.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
  )
  const setB = new Set(
    b.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
  )
  const intersection = new Set([...setA].filter((x) => setB.has(x)))
  const union = new Set([...setA, ...setB])
  return union.size === 0 ? 0 : intersection.size / union.size
}

// ---------------------------------------------------------------------------
// Anchor text builder
// ---------------------------------------------------------------------------

const SKIP_ANCHORS = new Set(['click here', 'read more', 'learn more', 'here', 'link'])

function buildAnchorText(keyword: string): string {
  const clean = keyword
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .slice(0, 8)
    .join(' ')
  if (SKIP_ANCHORS.has(clean)) return keyword
  return clean
}

// ---------------------------------------------------------------------------
// HTML injection helper
// ---------------------------------------------------------------------------

/**
 * Find the H2 heading with best Jaccard match to `anchor`, then inject the
 * link at the end of the second `<p>` paragraph after that heading.
 */
function injectLinkAfterBestH2(html: string, url: string, anchor: string): string {
  const h2Pattern = /<h2[^>]*>([\s\S]*?)<\/h2>/gi
  let bestH2Text = ''
  let bestScore = -1
  let h2Match: RegExpExecArray | null

  while ((h2Match = h2Pattern.exec(html)) !== null) {
    const headingText = h2Match[1].replace(/<[^>]+>/g, '')
    const score = jaccardSimilarity(headingText, anchor)
    if (score > bestScore) {
      bestScore = score
      bestH2Text = h2Match[1].replace(/<[^>]+>/g, '')
    }
  }

  const linkHtml = `<a href="${url}" title="${anchor}">${anchor}</a>`

  if (!bestH2Text) {
    // No H2 found — inject link at end of second paragraph in the document
    let count = 0
    return html.replace(/<\/p>/gi, (match) => {
      count++
      if (count === 2) return ` ${linkHtml}` + match
      return match
    })
  }

  // Find the H2 in the document and inject after second <p> that follows it
  const escaped = bestH2Text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const sectionPattern = new RegExp(
    `(<h2[^>]*>${escaped}<\\/h2>[\\s\\S]*?)(<\\/p>)([\\s\\S]*?<\\/p>)`,
    'i',
  )
  const injected = html.replace(sectionPattern, `$1$2<p>${linkHtml}</p>$3`)
  return injected !== html ? injected : html.replace(/<\/p>/i, ` ${linkHtml}</p>`)
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/** Inject up to 2 internal links into article HTML from sibling campaigns. */
export async function injectInternalLinks(
  html: string,
  campaignId: string,
): Promise<string> {
  // Get current campaign to find its niche
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { nicheSlug: true },
  })

  const nicheSlug = campaign?.nicheSlug ?? 'general'

  // Find sibling campaigns in same niche with published URLs
  const siblings = await prisma.campaign.findMany({
    where: {
      id: { not: campaignId },
      nicheSlug,
      publishJobs: {
        some: {
          status: 'published',
          platformUrl: { not: null },
        },
      },
    },
    include: {
      publishJobs: {
        where: { status: 'published', platformUrl: { not: null } },
        orderBy: { publishedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  if (siblings.length === 0) {
    return html
  }

  // Pick 2 most recent with published URLs
  const targets = siblings
    .filter((s) => s.publishJobs[0]?.platformUrl)
    .slice(0, 2)

  let result = html
  for (const sibling of targets) {
    const publishedUrl = sibling.publishJobs[0]?.platformUrl!
    // Get keyword from content brief
    const briefPiece = await prisma.contentPiece.findFirst({
      where: { campaignId: sibling.id, type: 'content_brief' },
      select: { serpBriefJson: true },
      orderBy: { createdAt: 'desc' },
    })

    let anchorKeyword = sibling.name
    if (briefPiece?.serpBriefJson) {
      const briefData = briefPiece.serpBriefJson as Record<string, unknown>
      const kw = briefData.primaryKeyword ?? briefData.contentBrief
      if (typeof kw === 'string') anchorKeyword = kw
    }

    const anchor = buildAnchorText(anchorKeyword)
    result = injectLinkAfterBestH2(result, publishedUrl, anchor)
  }

  return result
}
