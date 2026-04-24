/**
 * Spam score checker for Sprint 9.
 *
 * Uses a heuristic scoring model (no external API required):
 * - Detects spam trigger words in subject + body
 * - Penalises ALL CAPS, excessive exclamation marks, link density
 * - Checks image-to-text ratio
 * - Returns a score from 0–10 (lower = cleaner)
 *
 * Thresholds (per plan.md):
 *   < 2.0  → auto-send
 *   2.0–3.5 → dashboard warning
 *   > 3.5  → blocked, flagged for rewrite
 */

export interface SpamCheckResult {
  score: number
  verdict: 'ok' | 'warning' | 'blocked'
  issues: string[]
}

// High-value spam trigger words (subset of SpamAssassin corpus)
const SPAM_TRIGGERS = [
  'free', 'click here', 'act now', 'limited time', 'guaranteed',
  'winner', 'congratulations', 'make money', 'earn extra', 'no cost',
  'risk free', 'order now', 'special offer', 'urgent', 'dear friend',
  'buy now', 'amazing', 'cash bonus', 'double your', 'lowest price',
  'once in a lifetime', 'while supplies last', 'cash', 'prize', 'winner!',
  'unsubscribe', // in body body (ok in footer, not repeated)
  '100% free', 'no obligation', 'promise you',
]

const CAPS_THRESHOLD = 0.25 // > 25% CAPS in subject = flag
const EXCLAMATION_THRESHOLD = 2 // > 2 exclamation marks = flag
const LINK_DENSITY_THRESHOLD = 0.03 // > 3% of words are links = flag

export function checkSpamScore(subject: string, bodyHtml: string): SpamCheckResult {
  const issues: string[] = []
  let score = 0

  // Strip HTML for text analysis
  const bodyText = bodyHtml
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const combined = (subject + ' ' + bodyText).toLowerCase()
  const subjectLower = subject.toLowerCase()
  const words = bodyText.split(/\s+/).filter(Boolean)

  // 1. Spam trigger words
  for (const trigger of SPAM_TRIGGERS) {
    if (combined.includes(trigger)) {
      score += 0.3
      issues.push(`Spam trigger: "${trigger}"`)
      if (issues.length >= 8) break // cap issue list
    }
  }

  // 2. ALL CAPS ratio in subject
  const capsChars = (subject.match(/[A-Z]/g) ?? []).length
  const alphaChars = (subject.match(/[a-zA-Z]/g) ?? []).length
  const capsRatio = alphaChars > 0 ? capsChars / alphaChars : 0
  if (capsRatio > CAPS_THRESHOLD) {
    score += 0.8
    issues.push(`Excessive caps in subject (${Math.round(capsRatio * 100)}%)`)
  }

  // 3. Exclamation marks
  const exclamations = (subject + ' ' + bodyText).match(/!/g)?.length ?? 0
  if (exclamations > EXCLAMATION_THRESHOLD) {
    score += 0.4 * Math.min(exclamations - EXCLAMATION_THRESHOLD, 5)
    issues.push(`Too many exclamation marks (${exclamations})`)
  }

  // 4. Link density
  const linkMatches = bodyHtml.match(/<a\s/gi)?.length ?? 0
  const linkDensity = words.length > 0 ? linkMatches / words.length : 0
  if (linkDensity > LINK_DENSITY_THRESHOLD) {
    score += 0.5
    issues.push(`High link density (${Math.round(linkDensity * 100)}% of words)`)
  }

  // 5. Image only (no text — images blocked = blank email)
  const imgCount = (bodyHtml.match(/<img/gi) ?? []).length
  if (imgCount > 0 && words.length < 50) {
    score += 1.0
    issues.push('Too few words for image count (image-only risk)')
  }

  // 6. No unsubscribe link (CAN-SPAM violation)
  if (!bodyHtml.toLowerCase().includes('unsubscribe')) {
    score += 1.5
    issues.push('Missing unsubscribe link (CAN-SPAM required)')
  }

  // 7. Subject too short or too long
  if (subject.length < 10) {
    score += 0.3
    issues.push('Subject too short (<10 chars)')
  }
  if (subject.length > 70) {
    score += 0.2
    issues.push('Subject too long (>70 chars)')
  }

  // 8. Subject ends with exclamation
  if (subjectLower.endsWith('!')) {
    score += 0.3
    issues.push('Subject ends with exclamation mark')
  }

  score = Math.round(score * 10) / 10 // 1 decimal place

  const verdict: SpamCheckResult['verdict'] =
    score < 2.0 ? 'ok' : score <= 3.5 ? 'warning' : 'blocked'

  return { score, verdict, issues }
}
