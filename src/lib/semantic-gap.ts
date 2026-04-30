/**
 * Semantic Gap Analyzer — Sprint 3
 * Analyses Bing top 10 scraped pages to find:
 * - Named entities present in 7+ results (mandatory coverage)
 * - Entities present in 3–6 results (recommended)
 * - Entities completely absent from all results (differentiator opportunity)
 * - LSI terms common across content
 * - Average / target word count
 * - Required headings (appear in 5+ results)
 * - Common FAQ questions
 */

import nlp from 'compromise'
import natural from 'natural'
import type { SerpResult } from './serp-scraper'

export interface SemanticGapAnalysis {
  primaryKeyword: string
  avgWordCount: number
  targetWordCount: number
  /** Entities in 7+ results — must cover */
  mandatoryEntities: string[]
  /** Entities in 3–6 results — recommended */
  recommendedEntities: string[]
  /** Heading patterns in 5+ results */
  requiredHeadings: string[]
  /** Common LSI/n-gram terms seen frequently */
  lsiTerms: string[]
  /** FAQ questions found across results (deduplicated) */
  faqQuestions: string[]
  /** Top competitor URLs */
  competitorUrls: string[]
}

/** Normalize entity/term text for comparison */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

/** Extract bigrams and trigrams from text */
function extractNgrams(text: string, n: number): string[] {
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 3 && !/^\d+$/.test(w))
  const ngrams: string[] = []
  for (let i = 0; i < words.length - n + 1; i++) {
    ngrams.push(words.slice(i, i + n).join(' '))
  }
  return ngrams
}

/** Count occurrences across an array of string arrays */
function countFrequency<T>(arrays: T[][]): Map<T, number> {
  const freq = new Map<T, number>()
  for (const arr of arrays) {
    const seen = new Set(arr)
    Array.from(seen).forEach((item) => {
      freq.set(item, (freq.get(item) || 0) + 1)
    })
  }
  return freq
}

/** Extract named entities from text using compromise.js */
function extractEntities(text: string): string[] {
  const doc = nlp(text.slice(0, 30000)) // limit to keep it fast
  const people = doc.people().out('array') as string[]
  const places = doc.places().out('array') as string[]
  const topics = doc.topics().out('array') as string[]
  return [...people, ...places, ...topics]
    .map(normalize)
    .filter((e) => e.length > 2 && e.split(' ').length <= 4)
}

/**
 * TF-IDF augmentation — extract high-signal terms that appear across many SERP documents.
 * Uses natural.TfIdf to surface terms that are semantically important across the competition.
 * Returns up to 20 terms that appear in at least 3 documents.
 */
function extractTfIdfTerms(serpResults: SerpResult[]): string[] {
  if (serpResults.length === 0) return []
  const tfidf = new natural.TfIdf()
  for (const r of serpResults) {
    if (r.bodyText) tfidf.addDocument(r.bodyText.toLowerCase())
  }
  const termDocCount = new Map<string, number>()
  for (let i = 0; i < serpResults.length; i++) {
    const items = tfidf.listTerms(i).slice(0, 25)
    for (const item of items) {
      if (item.term.length < 4 || /^\d+$/.test(item.term)) continue
      termDocCount.set(item.term, (termDocCount.get(item.term) || 0) + 1)
    }
  }
  return Array.from(termDocCount.entries())
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([term]) => term)
    .slice(0, 20)
}

/** Run semantic gap analysis across all scraped SERP results */
export function analyzeSemanticGap(keyword: string, serpResults: SerpResult[]): SemanticGapAnalysis {
  const validResults = serpResults.filter((r) => r.wordCount > 100)
  const total = validResults.length || 1

  // Word count stats
  const wordCounts = validResults.map((r) => r.wordCount).filter((n) => n > 0)
  const avgWordCount = wordCounts.length
    ? Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length)
    : 1200
  const targetWordCount = Math.round(avgWordCount * 1.15) // +15% to outrank

  // Named entity extraction
  const entitySets = validResults.map((r) => Array.from(new Set(extractEntities(r.bodyText))))
  const entityFreq = countFrequency(entitySets)
  const mandatoryEntities = Array.from(entityFreq.entries())
    .filter(([, cnt]) => cnt >= Math.ceil(total * 0.7) && cnt >= 2)
    .map(([e]) => e)
    .slice(0, 30)

  const recommendedEntities = Array.from(entityFreq.entries())
    .filter(([, cnt]) => cnt >= Math.ceil(total * 0.3) && cnt < Math.ceil(total * 0.7))
    .map(([e]) => e)
    .slice(0, 20)

  // LSI terms: bigrams + trigrams that appear frequently
  const allBigrams = validResults.map((r) => extractNgrams(r.bodyText, 2))
  const allTrigrams = validResults.map((r) => extractNgrams(r.bodyText, 3))
  const bigramFreq = countFrequency(allBigrams)
  const trigramFreq = countFrequency(allTrigrams)

  const stopBigrams = new Set([
    'you can', 'is a', 'in the', 'to the', 'of the', 'and the', 'it is',
    'that the', 'this is', 'there are', 'at the', 'for the',
  ])

  const ngramLsiTerms = [
    ...Array.from(bigramFreq.entries())
      .filter(([term, cnt]) => cnt >= 3 && !stopBigrams.has(term))
      .sort((a, b) => b[1] - a[1])
      .map(([term]) => term)
      .slice(0, 15),
    ...Array.from(trigramFreq.entries())
      .filter(([, cnt]) => cnt >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([term]) => term)
      .slice(0, 10),
  ]

  // TF-IDF augmentation: extract high-signal terms that appear across many documents
  const tfidfTerms = extractTfIdfTerms(validResults)

  // Merge n-gram terms with TF-IDF terms, deduped
  const lsiSet = new Set([...ngramLsiTerms, ...tfidfTerms])
  const lsiTerms = Array.from(lsiSet).slice(0, 25)

  // Required headings: H2s that appear (normalized) in 5+ results
  const h2Sets = validResults.map((r) => r.h2.map(normalize))
  const h2Freq = countFrequency(h2Sets)
  const requiredHeadings = Array.from(h2Freq.entries())
    .filter(([, cnt]) => cnt >= Math.max(2, Math.ceil(total * 0.5)))
    .map(([h]) => h)
    .slice(0, 10)

  // FAQ questions: deduplicated across results
  const allFaqQ = validResults
    .flatMap((r) => r.faqPairs.map((f) => f.question))
    .map(normalize)
    .filter(Boolean)
  const faqFreq = countFrequency(allFaqQ.map((q) => [q]))
  const faqQuestions = Array.from(new Set(allFaqQ))
    .sort((a, b) => (faqFreq.get(b) || 0) - (faqFreq.get(a) || 0))
    .slice(0, 12)

  const competitorUrls = serpResults.map((r) => r.url).filter(Boolean)

  return {
    primaryKeyword: keyword,
    avgWordCount,
    targetWordCount,
    mandatoryEntities,
    recommendedEntities,
    lsiTerms,
    requiredHeadings,
    faqQuestions,
    competitorUrls,
  }
}
