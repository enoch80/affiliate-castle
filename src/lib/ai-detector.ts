/**
 * AI Detection Scorer — Sprint 4
 *
 * Heuristic-based AI detection scoring (0–100%).
 * Target: all content pieces must score <15% before advancing to content_ready.
 *
 * Unlike cloud-based detectors (GPTZero, Originality.ai), this runs entirely
 * locally in the worker container without external API calls.
 *
 * Scoring model: weighted combination of 6 signals
 *
 * Signal 1 — Burstiness (25%)
 *   Real humans vary sentence length erratically. AI is more uniform.
 *   Metric: coefficient of variation (stddev/mean) of sentence word counts.
 *   High uniformity → high AI score.
 *
 * Signal 2 — Lexical Diversity (20%)
 *   Type-Token Ratio (unique words / total words).
 *   Real humans reuse words less systematically. Very high TTR in long text signals AI.
 *   Metric: normalised TTR deviation from expected human range.
 *
 * Signal 3 — AI Phrase Density (25%)
 *   Count of known AI-tell phrases per 1000 words.
 *   High density → high score.
 *
 * Signal 4 — Transition Monotony (15%)
 *   Overuse of a single set of transitions (Furthermore, Moreover, Additionally…).
 *   High count → high score.
 *
 * Signal 5 — Paragraph Length Variance (10%)
 *   AI tends to produce uniform paragraph sizes.
 *   Low variance → higher score.
 *
 * Signal 6 — Perplexity Proxy (5%)
 *   Average word length as a crude perplexity proxy.
 *   Very high average word length signals formal/AI writing.
 */

// ─── Detection phrases ────────────────────────────────────────────────────────

const AI_TELL_PHRASES = [
  'in conclusion',
  'in summary',
  'to summarize',
  'it is important to',
  "it's important to",
  'it is worth noting',
  "it's worth noting",
  'in today\'s world',
  'in today\'s landscape',
  'in today\'s digital',
  'furthermore',
  'moreover',
  'additionally',
  'in addition to',
  'as previously mentioned',
  'as mentioned above',
  'as stated',
  'as noted',
  'it should be noted',
  'it must be noted',
  'needless to say',
  'having said that',
  'on the other hand',
  'in other words',
  'to put it simply',
  'simply put',
  'to put it another way',
  'at the end of the day',
  'in the final analysis',
  'all things considered',
  'with that being said',
  'that being said',
  'in light of',
  'it goes without saying',
  'last but not least',
  'first and foremost',
  'in terms of',
  'in order to',
  'due to the fact that',
  'utilize',
  'utilization',
  'leverage',
  'optimal',
  'optimize',
  'implement',
  'demonstrate',
  'delve into',
  'tailored to',
  'seamlessly',
  'robust',
  'pivotal',
  'cutting-edge',
  'state-of-the-art',
  'game-changer',
  'empowering',
]

const TRANSITION_TELLS = [
  'furthermore,',
  'moreover,',
  'additionally,',
  'in addition,',
  'subsequently,',
  'nevertheless,',
  'therefore,',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/\b[a-z']+\b/g) || []
}

function getSentences(text: string): string[] {
  const stripped = text.replace(/```[\s\S]*?```/g, '').replace(/<[^>]+>/g, ' ')
  return stripped.match(/[^.!?]+[.!?]+/g)?.map(s => s.trim()).filter(s => s.length > 5) || []
}

function getParagraphs(text: string): string[] {
  return text.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 30)
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  const variance = arr.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / arr.length
  return Math.sqrt(variance)
}

// ─── Individual signal scorers ────────────────────────────────────────────────

/**
 * Signal 1: Burstiness
 * High CV (>0.7) → human-like → low AI score
 * Low CV (<0.4) → uniform → high AI score
 */
function scoreBurstiness(sentences: string[]): number {
  if (sentences.length < 5) return 50 // insufficient data

  const lengths = sentences.map(s => s.split(/\s+/).length)
  const m = mean(lengths)
  if (m === 0) return 50

  const cv = stddev(lengths) / m

  // Very uniform (cv < 0.25) → 80% AI
  // Moderate (cv 0.25–0.5) → 50% AI
  // Human-like (cv > 0.7) → 10% AI
  if (cv < 0.25) return 80
  if (cv < 0.4) return 65
  if (cv < 0.5) return 50
  if (cv < 0.65) return 30
  return 10
}

/**
 * Signal 2: Lexical Diversity (Type-Token Ratio)
 * For long text, TTR between 0.3–0.55 is typical human range.
 * AI tends to 0.55–0.75 (varied but systematic).
 */
function scoreLexicalDiversity(words: string[]): number {
  if (words.length < 50) return 30 // too short to judge

  const unique = new Set(words).size
  const ttr = unique / words.length

  // Bucket normalised to a 100-word window (root TTR)
  const rootTTR = unique / Math.sqrt(words.length)

  // Normal human rootTTR ≈ 5-7 for 1000-word text
  // AI rootTTR often 7-10 (more varied vocabulary)
  if (rootTTR > 10) return 70
  if (rootTTR > 8) return 55
  if (rootTTR > 6.5) return 40
  if (rootTTR > 5) return 25
  return 20
}

/**
 * Signal 3: AI Phrase Density
 * Measured as occurrences per 1000 words.
 */
function scoreAIPhraseDensity(text: string, wordCount: number): number {
  const lower = text.toLowerCase()
  let count = 0
  for (const phrase of AI_TELL_PHRASES) {
    const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    const matches = lower.match(regex)
    if (matches) count += matches.length
  }

  const density = (count / Math.max(wordCount, 1)) * 1000

  if (density < 1) return 5
  if (density < 3) return 20
  if (density < 6) return 40
  if (density < 10) return 60
  if (density < 15) return 75
  return 90
}

/**
 * Signal 4: Transition Monotony
 * Count of overused AI transitions per 1000 words.
 */
function scoreTransitionMonotony(text: string, wordCount: number): number {
  const lower = text.toLowerCase()
  let count = 0
  for (const phrase of TRANSITION_TELLS) {
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    const matches = lower.match(regex)
    if (matches) count += matches.length
  }

  const density = (count / Math.max(wordCount, 1)) * 1000

  if (density < 1) return 5
  if (density < 3) return 25
  if (density < 6) return 50
  return 80
}

/**
 * Signal 5: Paragraph Length Variance
 * Low CV → uniform paragraphs → AI-like
 */
function scoreParagraphVariance(paragraphs: string[]): number {
  if (paragraphs.length < 3) return 30

  const lengths = paragraphs.map(p => p.split(/\s+/).length)
  const m = mean(lengths)
  if (m === 0) return 30

  const cv = stddev(lengths) / m

  if (cv < 0.2) return 70
  if (cv < 0.35) return 50
  if (cv < 0.5) return 35
  return 15
}

/**
 * Signal 6: Average word length proxy
 * Very long average (>6 chars) signals formal/technical AI writing
 */
function scoreWordLength(words: string[]): number {
  if (words.length === 0) return 30
  const avgLen = mean(words.map(w => w.length))

  if (avgLen > 6.5) return 65
  if (avgLen > 5.5) return 45
  if (avgLen > 4.5) return 25
  return 10
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface DetectionResult {
  score: number           // 0–100 (lower = more human-like)
  percentHuman: number    // 100 - score
  passesThreshold: boolean // score < 15
  signals: {
    burstiness: number
    lexicalDiversity: number
    aiPhraseDensity: number
    transitionMonotony: number
    paragraphVariance: number
    wordLength: number
  }
  wordCount: number
}

/**
 * Weights must sum to 1.0
 */
const WEIGHTS = {
  burstiness: 0.25,
  lexicalDiversity: 0.20,
  aiPhraseDensity: 0.25,
  transitionMonotony: 0.15,
  paragraphVariance: 0.10,
  wordLength: 0.05,
}

/**
 * Score a piece of text. Returns 0-100 where:
 * - 0   = undetectably human
 * - 100 = clearly AI-generated
 * - <15 = passes the Sprint 4 threshold
 */
export function scoreContent(text: string): DetectionResult {
  // Strip JSON and HTML before analysis
  const isJson = text.trim().startsWith('[') || text.trim().startsWith('{')
  const isHtml = text.trim().startsWith('<') || text.trim().startsWith('<!DOCTYPE')

  let analysisText = text

  if (isJson) {
    try {
      const parsed = JSON.parse(text)
      // Flatten to plain text — join all string values
      const flatten = (obj: unknown): string => {
        if (typeof obj === 'string') return obj
        if (Array.isArray(obj)) return obj.map(flatten).join(' ')
        if (typeof obj === 'object' && obj !== null) {
          return Object.values(obj as Record<string, unknown>).map(flatten).join(' ')
        }
        return ''
      }
      analysisText = flatten(parsed)
    } catch {
      // Use text as-is
    }
  } else if (isHtml) {
    analysisText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  const words = tokenize(analysisText)
  const sentences = getSentences(analysisText)
  const paragraphs = getParagraphs(analysisText)
  const wordCount = words.length

  if (wordCount < 30) {
    // Too short to score meaningfully — assume passes
    return {
      score: 5,
      percentHuman: 95,
      passesThreshold: true,
      signals: { burstiness: 5, lexicalDiversity: 5, aiPhraseDensity: 5, transitionMonotony: 5, paragraphVariance: 5, wordLength: 5 },
      wordCount,
    }
  }

  const signals = {
    burstiness: scoreBurstiness(sentences),
    lexicalDiversity: scoreLexicalDiversity(words),
    aiPhraseDensity: scoreAIPhraseDensity(analysisText, wordCount),
    transitionMonotony: scoreTransitionMonotony(analysisText, wordCount),
    paragraphVariance: scoreParagraphVariance(paragraphs),
    wordLength: scoreWordLength(words),
  }

  const score = Math.round(
    signals.burstiness * WEIGHTS.burstiness +
    signals.lexicalDiversity * WEIGHTS.lexicalDiversity +
    signals.aiPhraseDensity * WEIGHTS.aiPhraseDensity +
    signals.transitionMonotony * WEIGHTS.transitionMonotony +
    signals.paragraphVariance * WEIGHTS.paragraphVariance +
    signals.wordLength * WEIGHTS.wordLength
  )

  const clampedScore = Math.max(0, Math.min(100, score))

  return {
    score: clampedScore,
    percentHuman: 100 - clampedScore,
    passesThreshold: clampedScore < 15,
    signals,
    wordCount,
  }
}

/**
 * Score a batch of content pieces.
 * Returns true if ALL pieces pass (<15% AI score).
 */
export function scoreAllContent(
  pieces: Array<{ type: string; text: string }>
): Array<{ type: string; detection: DetectionResult }> {
  return pieces.map(piece => ({
    type: piece.type,
    detection: scoreContent(piece.text),
  }))
}
