/**
 * SEO Scorer + Gate — Sprint C
 *
 * 15-rule weighted scoring engine. Evaluates article HTML/text and returns a
 * numeric score (0–100) plus a list of actionable issues.
 *
 * Gate: score ≥ 70 required to publish (§4.7)
 * autoFixSEO() applies one-pass repair on common, fixable failures.
 *
 * Spec reference: §4.7
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SEOScoreInput {
  /** Raw HTML or Markdown of the article */
  html: string
  /** Primary keyword (optional — if omitted keyword rules fail automatically) */
  keyword?: string
  /** Target word count from content brief */
  targetWordCount?: number
  /** Meta description string */
  metaDescription?: string
  /** Mandatory NLP entities that must appear */
  mandatoryEntities?: string[]
  /** LSI terms; ≤2 missing passes */
  lsiTerms?: string[]
}

export interface SEORuleResult {
  id: string
  label: string
  passed: boolean
  weight: number
  detail?: string
}

export interface SEOScoreResult {
  score: number
  grade: 'A' | 'B' | 'C' | 'F'
  issues: string[]
  rules: SEORuleResult[]
}

// ---------------------------------------------------------------------------
// Scoring gate constant (§4.7)
// ---------------------------------------------------------------------------
export const SEO_GATE_SCORE = 70

// ---------------------------------------------------------------------------
// HTML utilities
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (titleMatch) return stripHtml(titleMatch[1]).trim()
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (h1Match) return stripHtml(h1Match[1]).trim()
  return ''
}

function countHeadings(html: string, tag: 'h1' | 'h2' | 'h3'): number {
  const regex = new RegExp(`<${tag}[^>]*>`, 'gi')
  return (html.match(regex) ?? []).length
}

function countInternalLinks(html: string): number {
  const links = html.match(/<a\s[^>]*href=["']([^"']+)["'][^>]*>/gi) ?? []
  return links.filter((a) => {
    const href = a.match(/href=["']([^"']+)["']/i)?.[1] ?? ''
    return href.startsWith('/') || href.startsWith('#')
  }).length
}

function countExternalLinks(html: string): number {
  const links = html.match(/<a\s[^>]*href=["']([^"']+)["'][^>]*>/gi) ?? []
  return links.filter((a) => {
    const href = a.match(/href=["']([^"']+)["']/i)?.[1] ?? ''
    return href.startsWith('http')
  }).length
}

/** Rough Flesch-Kincaid Reading Ease estimator */
function fleschReadingEase(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length || 1
  const words = countWords(text)
  const syllables = estimateSyllables(text)

  if (words === 0) return 0
  return 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)
}

function estimateSyllables(text: string): number {
  return text
    .toLowerCase()
    .replace(/[^a-z]/g, ' ')
    .split(/\s+/)
    .reduce((sum, word) => {
      if (!word) return sum
      // Count vowel groups as syllables — rough but good enough for scoring
      const syllableCount = (word.match(/[aeiouy]+/g) ?? []).length
      return sum + Math.max(syllableCount, 1)
    }, 0)
}

function keywordDensity(text: string, keyword: string): number {
  if (!keyword) return 0
  const kw = keyword.toLowerCase()
  const words = text.toLowerCase().split(/\s+/).filter(Boolean)
  const kwWords = kw.split(/\s+/)
  let occurrences = 0
  for (let i = 0; i <= words.length - kwWords.length; i++) {
    if (kwWords.every((kw, j) => words[i + j] === kw)) occurrences++
  }
  return words.length > 0 ? (occurrences * kwWords.length) / words.length : 0
}

// ---------------------------------------------------------------------------
// Core scorer
// ---------------------------------------------------------------------------

/** Score article content against 15 SEO rules.
 *  @param html  Raw HTML or Markdown-ish text of the article
 *  @param params Optional context (keyword, target word count, meta, entities, LSI)
 */
export function scoreContent(html: string, params: Partial<SEOScoreInput> = {}): SEOScoreResult {
  const kw = (params.keyword ?? '').toLowerCase().trim()
  const targetWc = params.targetWordCount ?? 0
  const meta = params.metaDescription ?? ''
  const mandatoryEntities = params.mandatoryEntities ?? []
  const lsiTerms = params.lsiTerms ?? []

  const text = stripHtml(html)
  const title = extractTitle(html)
  const words = countWords(text)
  const h1Count = countHeadings(html, 'h1')
  const h2Count = countHeadings(html, 'h2')
  const internalLinks = countInternalLinks(html)
  const externalLinks = countExternalLinks(html)
  const density = keywordDensity(text, kw)
  const fre = fleschReadingEase(text)
  const hasFAQ = /##\s*(frequently asked|faq)/i.test(text) ||
    /<h2[^>]*>(frequently asked|faq)/i.test(html)

  const first100 = text.split(/\s+/).slice(0, 100).join(' ').toLowerCase()
  const first35OfTitle = title.slice(0, 35).toLowerCase()

  // ── Rule evaluations ────────────────────────────────────────────────────
  const rules: SEORuleResult[] = [
    {
      id: 'R1',
      label: 'Keyword in title (first 35 chars)',
      weight: 15,
      passed: kw.length > 0 && first35OfTitle.includes(kw),
      detail: kw.length === 0 ? 'No keyword provided' : `Title first 35 chars: "${title.slice(0, 35)}"`,
    },
    {
      id: 'R2',
      label: 'Title length 50–65 chars',
      weight: 5,
      passed: title.length >= 50 && title.length <= 65,
      detail: `Title length: ${title.length}`,
    },
    {
      id: 'R3',
      label: 'Keyword in H1',
      weight: 10,
      passed: (() => {
        if (!kw) return false
        const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
        const h1Text = h1Match ? stripHtml(h1Match[1]).toLowerCase() : ''
        return h1Text.includes(kw)
      })(),
      detail: kw.length === 0 ? 'No keyword provided' : undefined,
    },
    {
      id: 'R4',
      label: 'Keyword in first 100 words',
      weight: 10,
      passed: kw.length > 0 && first100.includes(kw),
      detail: kw.length === 0 ? 'No keyword provided' : undefined,
    },
    {
      id: 'R5',
      label: 'Keyword density 1.0–2.5%',
      weight: 10,
      passed: kw.length > 0 && density >= 0.01 && density <= 0.025,
      detail: kw.length === 0
        ? 'No keyword provided'
        : `Density: ${(density * 100).toFixed(2)}%`,
    },
    {
      id: 'R6',
      label: 'Meta description 150–162 chars',
      weight: 5,
      passed: meta.length >= 150 && meta.length <= 162,
      detail: `Meta length: ${meta.length}`,
    },
    {
      id: 'R7',
      label: 'Keyword in meta description',
      weight: 5,
      passed: kw.length > 0 && meta.toLowerCase().includes(kw),
      detail: kw.length === 0 ? 'No keyword provided' : undefined,
    },
    {
      id: 'R8',
      label: 'Word count meets target',
      weight: 10,
      passed: targetWc > 0 ? words >= targetWc : words >= 1500,
      detail: `Words: ${words}${targetWc > 0 ? ` / target: ${targetWc}` : ''}`,
    },
    {
      id: 'R9',
      label: 'FAQ section present',
      weight: 5,
      passed: hasFAQ,
      detail: hasFAQ ? 'FAQ section found' : 'No FAQ section detected',
    },
    {
      id: 'R10',
      label: 'All mandatory entities present',
      weight: 10,
      passed: (() => {
        if (mandatoryEntities.length === 0) return true
        const lower = text.toLowerCase()
        return mandatoryEntities.every((e) => lower.includes(e.toLowerCase()))
      })(),
      detail: (() => {
        if (mandatoryEntities.length === 0) return 'No mandatory entities specified'
        const lower = text.toLowerCase()
        const missing = mandatoryEntities.filter((e) => !lower.includes(e.toLowerCase()))
        return missing.length > 0 ? `Missing entities: ${missing.join(', ')}` : 'All entities present'
      })(),
    },
    {
      id: 'R11',
      label: 'LSI terms coverage (≤2 missing)',
      weight: 5,
      passed: (() => {
        if (lsiTerms.length === 0) return true
        const lower = text.toLowerCase()
        const missing = lsiTerms.filter((t) => !lower.includes(t.toLowerCase()))
        return missing.length <= 2
      })(),
      detail: (() => {
        if (lsiTerms.length === 0) return 'No LSI terms specified'
        const lower = text.toLowerCase()
        const missing = lsiTerms.filter((t) => !lower.includes(t.toLowerCase()))
        return `Missing LSI terms: ${missing.length} of ${lsiTerms.length}`
      })(),
    },
    {
      id: 'R12',
      label: 'Internal links present (≥1)',
      weight: 5,
      passed: internalLinks >= 1,
      detail: `Internal links: ${internalLinks}`,
    },
    {
      id: 'R13',
      label: 'External links present (≥1)',
      weight: 5,
      passed: externalLinks >= 1,
      detail: `External links: ${externalLinks}`,
    },
    {
      id: 'R14',
      label: 'Heading hierarchy valid (H1=1, H2≥3)',
      weight: 5,
      passed: h1Count === 1 && h2Count >= 3,
      detail: `H1: ${h1Count}, H2: ${h2Count}`,
    },
    {
      id: 'R15',
      label: 'Flesch Reading Ease 55–80',
      weight: 5,
      passed: fre >= 55 && fre <= 80,
      detail: `FRE: ${fre.toFixed(1)}`,
    },
  ]

  // ── Calculate score ─────────────────────────────────────────────────────
  const totalWeight = rules.reduce((s, r) => s + r.weight, 0)
  const earnedWeight = rules.filter((r) => r.passed).reduce((s, r) => s + r.weight, 0)
  const score = Math.round((earnedWeight / totalWeight) * 100)

  const grade: 'A' | 'B' | 'C' | 'F' =
    score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'F'

  const issues = rules
    .filter((r) => !r.passed)
    .map((r) => `${r.id}: ${r.label}${r.detail ? ` (${r.detail})` : ''}`)

  return { score, grade, issues, rules }
}

// ---------------------------------------------------------------------------
// Auto-fix
// ---------------------------------------------------------------------------

/** One-pass repair for the most common fixable SEO failures.
 *  - Missing LSI terms → inject into second paragraph
 *  - Missing mandatory entities → append to last section before Conclusion
 *  - Missing FAQ section → append a minimal FAQ block with first 3 issues as questions
 */
export function autoFixSEO(
  html: string,
  result: SEOScoreResult,
  params: Partial<SEOScoreInput> = {},
): string {
  let fixed = html
  const lsiTerms = params.lsiTerms ?? []
  const mandatoryEntities = params.mandatoryEntities ?? []
  const text = stripHtml(html).toLowerCase()

  // Fix R11: inject missing LSI terms into the second paragraph
  const missingLsi = lsiTerms.filter((t) => !text.includes(t.toLowerCase()))
  if (missingLsi.length > 0) {
    const lsiSentence = ` This guide covers key concepts including ${missingLsi.join(', ')}.`
    // Find second <p> tag and append inside it
    let count = 0
    fixed = fixed.replace(/<\/p>/i, (match) => {
      count++
      if (count === 2) return lsiSentence + match
      return match
    })
  }

  // Fix R10: inject missing mandatory entities
  const missingEntities = mandatoryEntities.filter((e) => !text.includes(e.toLowerCase()))
  if (missingEntities.length > 0) {
    const entityNote = `\n<p><em>Note: This article also covers ${missingEntities.join(', ')}.</em></p>`
    // Insert before the last </h2> or before </article> or appended before </body>
    if (fixed.includes('</body>')) {
      fixed = fixed.replace('</body>', entityNote + '\n</body>')
    } else {
      fixed += entityNote
    }
  }

  // Fix R9: append minimal FAQ section if missing
  if (!result.rules.find((r) => r.id === 'R9')?.passed) {
    const faqBlock = `
<h2>Frequently Asked Questions</h2>
<dl>
  <dt>What is the best way to get started?</dt>
  <dd>Begin with the fundamentals covered in this guide and progress step by step.</dd>
  <dt>How long does it take to see results?</dt>
  <dd>Most practitioners see measurable progress within 4–8 weeks of consistent effort.</dd>
  <dt>Are there any prerequisites?</dt>
  <dd>No prior experience is required. This guide is designed for beginners.</dd>
</dl>`
    if (fixed.includes('</body>')) {
      fixed = fixed.replace('</body>', faqBlock + '\n</body>')
    } else {
      fixed += faqBlock
    }
  }

  return fixed
}
