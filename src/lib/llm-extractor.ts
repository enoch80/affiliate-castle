/**
 * LLM Extractor
 * Sends scraped page data to Mistral via OpenRouter to extract
 * structured offer details: product name, niche, price, commission, benefits, etc.
 */

import type { ScrapedPage } from './offer-scraper'
import { callMistral } from './mistral'

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
  "niche": "one of: health, wealth, relationships, software, survival, woodworking, fishing, gardening, bird_watching, knitting, model_trains, astronomy, aquarium, beekeeping, hiking, photography, chess, other",
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
 * Extract offer details using Mistral via OpenRouter.
 * Falls back to rule-based extraction if the API is unavailable.
 */
export async function extractOfferDetails(page: ScrapedPage): Promise<OfferExtraction> {
  try {
    const extraction = await queryMistral(page)
    if (extraction) return extraction
  } catch (err) {
    console.warn('[llm-extractor] Mistral failed, using fallback extraction:', err)
  }

  return fallbackExtraction(page)
}

async function queryMistral(page: ScrapedPage): Promise<OfferExtraction | null> {
  const rawText = await callMistral(EXTRACTION_PROMPT(page), 'small', 0.1)

  // Extract JSON from the response (LLM sometimes adds preamble)
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in Mistral response')

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

// Canonical niche identifiers — used by detectNiche() and offer-pipeline normalization
export const CANONICAL_NICHES = [
  'health', 'wealth', 'relationships', 'software', 'survival',
  'woodworking', 'fishing', 'gardening', 'bird_watching', 'knitting',
  'model_trains', 'astronomy', 'aquarium', 'beekeeping', 'hiking',
  'photography', 'chess',
] as const

export type CanonicalNiche = typeof CANONICAL_NICHES[number] | 'other'

function detectNiche(text: string): CanonicalNiche {
  const niches: Record<CanonicalNiche, string[]> = {
    health: ['weight loss', 'diet', 'fat burn', 'health', 'fitness', 'muscle', 'keto', 'diabetes', 'blood sugar'],
    wealth: ['make money', 'income', 'affiliate', 'trading', 'invest', 'crypto', 'forex', 'online business', 'passive income'],
    relationships: ['dating', 'relationship', 'marriage', 'love', 'attraction', 'ex back', 'romance'],
    software: ['software', 'app', 'tool', 'saas', 'plugin', 'automation', 'ai tool', 'productivity'],
    survival: ['survival', 'prepper', 'emergency', 'bug out', 'self defense', 'homestead'],
    woodworking: ['woodworking', 'wood project', 'woodcraft', 'carpentry', 'wood plans', 'lumber', 'joinery', 'cabinet making'],
    fishing: ['fishing', 'bass fishing', 'fly fishing', 'tackle', 'angling', 'lure', 'fish finder', 'rod and reel'],
    gardening: ['gardening', 'vegetable garden', 'raised bed', 'composting', 'grow your own', 'organic garden', 'seed starting'],
    bird_watching: ['bird watching', 'birding', 'binoculars', 'bird feeder', 'ornithology', 'bird identification', 'backyard birds'],
    knitting: ['knitting', 'crochet', 'yarn', 'knit pattern', 'crocheting', 'wool', 'needle craft', 'amigurumi'],
    model_trains: ['model train', 'model railroad', 'rc car', 'remote control', 'ho scale', 'n scale', 'slot car', 'model kit'],
    astronomy: ['astronomy', 'telescope', 'stargazing', 'astrophotography', 'planet', 'constellation', 'lunar', 'deep sky'],
    aquarium: ['aquarium', 'fish tank', 'reef tank', 'tropical fish', 'fishkeeping', 'planted tank', 'cichlid', 'saltwater tank'],
    beekeeping: ['beekeeping', 'beekeeper', 'honey bee', 'hive', 'apiary', 'queen bee', 'bee colony', 'honey harvest'],
    hiking: ['hiking', 'backpacking', 'trail', 'camping', 'wilderness', 'trekking', 'tent', 'outdoor gear', 'national park'],
    photography: ['photography', 'photo editing', 'lightroom', 'camera settings', 'portrait photography', 'landscape photo', 'photoshop'],
    chess: ['chess', 'chess opening', 'chess strategy', 'board game', 'chess puzzle', 'endgame', 'chess tactics'],
    other: [],
  }

  for (const [niche, keywords] of Object.entries(niches) as [CanonicalNiche, string[]][]) {
    if (niche === 'other') continue
    if (keywords.some(kw => text.includes(kw))) return niche
  }
  return 'other'
}
