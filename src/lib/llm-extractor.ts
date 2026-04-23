/**
 * LLM Extractor
 * Sends scraped page data to Ollama (local Llama 3) to extract
 * structured offer details: product name, niche, price, commission, benefits, etc.
 */

import type { ScrapedPage } from './offer-scraper'

export interface OfferExtraction {
  productName: string
  niche: string
  pricePoint: number | null
  commissionPct: number | null
  commissionFixed: number | null
  targetAudience: string[]
  painPoints: string[]
  benefits: string[]
  trustSignals: string[]
  primaryKeyword: string
  secondaryKeywords: string[]
  angle: string
  confidence: number
}

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://ollama:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.3:70b'

const EXTRACTION_PROMPT = (page: ScrapedPage) => `
You are an expert affiliate marketer analyzing a product sales page.
Extract structured data from the following page content and return ONLY valid JSON.

Page URL: ${page.url}
Page Title: ${page.title}
Main Headline (H1): ${page.h1 || 'unknown'}
All Headlines: ${page.headlines.slice(0, 8).join(' | ')}
Price signals found: ${page.priceText || 'none detected'}
Guarantee signals: ${page.guaranteeText || 'none detected'}
Page body text (first 2000 chars):
${page.bodyText.slice(0, 2000)}

Return ONLY this JSON structure (no markdown, no explanation):
{
  "productName": "exact product name",
  "niche": "one of: health, wealth, relationships, software, survival, other",
  "pricePoint": <number or null>,
  "commissionPct": <number 0-100 or null>,
  "commissionFixed": <number or null>,
  "targetAudience": ["audience segment 1", "audience segment 2"],
  "painPoints": ["pain point 1", "pain point 2", "pain point 3"],
  "benefits": ["benefit 1", "benefit 2", "benefit 3"],
  "trustSignals": ["money-back guarantee", "testimonials", etc.],
  "primaryKeyword": "best long-tail keyword for this offer",
  "secondaryKeywords": ["keyword2", "keyword3", "keyword4"],
  "angle": "one sentence marketing angle for this offer",
  "confidence": <0.0-1.0>
}
`.trim()

/**
 * Extract offer details using local Ollama LLM
 * Falls back to rule-based extraction if Ollama is unavailable
 */
export async function extractOfferDetails(page: ScrapedPage): Promise<OfferExtraction> {
  try {
    const extraction = await queryOllama(page)
    if (extraction) return extraction
  } catch (err) {
    console.warn('[llm-extractor] Ollama failed, using fallback extraction:', err)
  }

  return fallbackExtraction(page)
}

async function queryOllama(page: ScrapedPage): Promise<OfferExtraction | null> {
  const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: EXTRACTION_PROMPT(page),
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 800,
      },
    }),
    signal: AbortSignal.timeout(120000), // LLM can be slow
  })

  if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`)

  const data = await resp.json()
  const rawText: string = data.response || ''

  // Extract JSON from the response (LLM sometimes adds preamble)
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in LLM response')

  const parsed = JSON.parse(jsonMatch[0]) as OfferExtraction
  return parsed
}

/**
 * Rule-based fallback when Ollama is unavailable or times out
 */
function fallbackExtraction(page: ScrapedPage): OfferExtraction {
  const text = (page.bodyText + ' ' + page.title + ' ' + (page.h1 || '')).toLowerCase()

  const niche = detectNiche(text)
  const productName = page.h1 || page.title.split(' - ')[0] || 'Unknown Product'

  // Extract price from priceText
  let pricePoint: number | null = null
  if (page.priceText) {
    const m = page.priceText.match(/[\d,]+(?:\.\d{2})?/)
    if (m) pricePoint = parseFloat(m[0].replace(',', ''))
  }

  return {
    productName,
    niche,
    pricePoint,
    commissionPct: null,
    commissionFixed: null,
    targetAudience: [`People interested in ${niche}`],
    painPoints: [`Struggling with ${niche}-related challenges`],
    benefits: [`Improve ${niche} results`, 'Save time and money', 'Proven system'],
    trustSignals: page.guaranteeText ? [page.guaranteeText] : ['Money-back guarantee'],
    primaryKeyword: `best ${niche} program`,
    secondaryKeywords: [`${niche} system`, `${niche} guide`, `${niche} tips`],
    angle: `Discover the proven ${niche} system that's changing lives`,
    confidence: 0.3,
  }
}

function detectNiche(text: string): string {
  const niches: Record<string, string[]> = {
    health: ['weight loss', 'diet', 'fat burn', 'health', 'fitness', 'muscle', 'keto', 'diabetes', 'blood sugar'],
    wealth: ['make money', 'income', 'affiliate', 'trading', 'invest', 'crypto', 'forex', 'online business', 'passive income'],
    relationships: ['dating', 'relationship', 'marriage', 'love', 'attraction', 'ex back', 'romance'],
    software: ['software', 'app', 'tool', 'saas', 'plugin', 'automation', 'ai tool', 'productivity'],
    survival: ['survival', 'prepper', 'emergency', 'bug out', 'self defense', 'homestead'],
  }

  for (const [niche, keywords] of Object.entries(niches)) {
    if (keywords.some(kw => text.includes(kw))) return niche
  }
  return 'other'
}
