/**
 * Bridge Renderer — Sprint 5
 *
 * Selects the correct HTML template based on niche, injects all content
 * variables, and creates BridgePage DB records. Creates two variants (A/B)
 * using headline_a vs headline_b from the generated content.
 *
 * Templates available:
 *  review.html          — Software, tools, supplements
 *  story.html           — MMO, weight loss, relationships
 *  comparison.html      — Offers with direct competitors
 *  problem-solution.html — Health, survival, finance
 */

import { readFileSync } from 'fs'
import path from 'path'
import { prisma } from './prisma'

const TEMPLATES_DIR = path.join(process.cwd(), 'templates', 'bridge')

/** Niche → template mapping */
const NICHE_TEMPLATES: Record<string, string> = {
  software: 'review',
  tools: 'review',
  supplements: 'review',
  saas: 'review',
  'make money online': 'story',
  mmo: 'story',
  'weight loss': 'story',
  fitness: 'story',
  relationships: 'story',
  dating: 'story',
  health: 'problem-solution',
  survival: 'problem-solution',
  finance: 'problem-solution',
  investing: 'problem-solution',
  default: 'comparison',
}

/** Niche → CSS color variables */
const NICHE_COLORS: Record<string, { bg: string; accent: string }> = {
  health: { bg: '#0D1117', accent: '#22C55E' },
  fitness: { bg: '#0D1117', accent: '#22C55E' },
  'weight loss': { bg: '#0D1117', accent: '#22C55E' },
  supplements: { bg: '#0D1117', accent: '#22C55E' },
  finance: { bg: '#0A0A0A', accent: '#EAB308' },
  investing: { bg: '#0A0A0A', accent: '#EAB308' },
  'make money online': { bg: '#0A0A0A', accent: '#EAB308' },
  mmo: { bg: '#0A0A0A', accent: '#EAB308' },
  relationships: { bg: '#1A0A0A', accent: '#EC4899' },
  dating: { bg: '#1A0A0A', accent: '#EC4899' },
  software: { bg: '#0F172A', accent: '#6366F1' },
  saas: { bg: '#0F172A', accent: '#6366F1' },
  tools: { bg: '#0F172A', accent: '#6366F1' },
  survival: { bg: '#111811', accent: '#84CC16' },
  default: { bg: '#0F172A', accent: '#6366F1' },
}

/** Slugify a string for use as a URL slug */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

function pickTemplate(niche: string): string {
  const key = niche.toLowerCase()
  for (const [nicheKey, templateId] of Object.entries(NICHE_TEMPLATES)) {
    if (key.includes(nicheKey)) return templateId
  }
  return NICHE_TEMPLATES.default
}

function pickColors(niche: string): { bg: string; accent: string } {
  const key = niche.toLowerCase()
  for (const [nicheKey, colors] of Object.entries(NICHE_COLORS)) {
    if (key.includes(nicheKey)) return colors
  }
  return NICHE_COLORS.default
}

/** Build HTML <li> items from string array */
function liItems(items: string[]): string {
  return items.map(i => `<li>${i}</li>`).join('\n')
}

/** Build trust bar spans from string array */
function trustBarSpans(items: string[]): string {
  return items.slice(0, 5).map(t => `<span>${t}</span>`).join('\n')
}

/** Build testimonial cards (3 synthetic but realistic testimonials) */
function buildTestimonials(productName: string, primaryKeyword: string, benefits: string[]): string {
  const cards = [
    {
      stars: '⭐⭐⭐⭐⭐',
      text: `I was skeptical at first, but after trying ${productName}, the results were clear within a few weeks. ${benefits[0] || 'Noticed a real difference right away'}.`,
      author: 'Sarah M., Austin TX',
    },
    {
      stars: '⭐⭐⭐⭐⭐',
      text: `Finally found something that actually works for ${primaryKeyword}. ${benefits[1] || 'Everything they say about it is true'}. My only regret is not starting sooner.`,
      author: 'David K., Phoenix AZ',
    },
    {
      stars: '⭐⭐⭐⭐⭐',
      text: `I've tried dozens of solutions for ${primaryKeyword}. This is the only one I'd recommend without hesitation. ${benefits[2] || 'The results speak for themselves'}.`,
      author: 'Rachel T., Denver CO',
    },
  ]
  return cards.map(c => `
    <div class="testimonial">
      <div class="stars">${c.stars}</div>
      <p>${c.text}</p>
      <span class="author">${c.author}</span>
    </div>`).join('\n')
}

/** Build FAQ details/summary accordion items from array */
function buildFAQItems(faqItems: Array<{ question: string; answer: string }>): string {
  return faqItems.slice(0, 8).map(f => `
    <details class="faq-item">
      <summary class="faq-q">${f.question}</summary>
      <div class="faq-a">${f.answer}</div>
    </details>`).join('\n')
}

/** Build comparison table rows (review template) */
function buildComparisonRows(benefits: string[]): string {
  const features = [
    ['Proven Results', '✓', '~', '✗'],
    ['Easy to Follow', '✓', '✓', '✗'],
    ['Money-Back Guarantee', '✓', '✗', '✗'],
    ['Ongoing Support', '✓', '~', '✗'],
    ['Works for Beginners', '✓', '✓', '✗'],
    ...(benefits.slice(0, 3).map(b => [b.slice(0, 40), '✓', '✗', '✗'])),
  ]
  return features.map(([feat, a, b, c]) => `
    <tr>
      <td class="feature-col">${feat}</td>
      <td class="winner">${a === '✓' ? '<span class="check">✓</span>' : a === '~' ? '~' : '<span class="cross">✗</span>'}</td>
      <td>${b === '✓' ? '<span class="check">✓</span>' : b === '~' ? '~' : '<span class="cross">✗</span>'}</td>
      <td>${c === '✓' ? '<span class="check">✓</span>' : c === '~' ? '~' : '<span class="cross">✗</span>'}</td>
    </tr>`).join('\n')
}

/** Build story timeline steps */
function buildTimelineSteps(benefits: string[]): string {
  return benefits.slice(0, 4).map((b, i) => `
    <div class="timeline-card">
      <div class="timeline-num">${i + 1}</div>
      <div class="timeline-text">
        <h4>Week ${(i + 1) * 2}</h4>
        <p>${b}</p>
      </div>
    </div>`).join('\n')
}

/** Build solution steps for problem-solution template */
function buildSolutionSteps(benefits: string[]): string {
  return benefits.slice(0, 3).map((b, i) => `
    <div class="step">
      <div class="step-num">${i + 1}</div>
      <div class="step-body">
        <h4>Step ${i + 1}</h4>
        <p>${b}</p>
      </div>
    </div>`).join('\n')
}

/** Build optin bullets from benefits */
function buildOptinBullets(benefits: string[]): string {
  return benefits.slice(0, 4).map(b => `<li>${b}</li>`).join('\n')
}

/** Build pain points list items */
function buildPainList(painPoints: string[]): string {
  return painPoints.slice(0, 5).map(p => `<li>${p}</li>`).join('\n')
}

/** Build benefit bullets */
function buildBenefitBullets(benefits: string[]): string {
  return benefits.slice(0, 5).map(b => `<li>${b}</li>`).join('\n')
}

/** Build review pros/cons lists */
function buildProsItems(benefits: string[]): string {
  return benefits.slice(0, 4).map(b => `<li>${b}</li>`).join('\n')
}
function buildConsItems(): string {
  return [
    'Only available online — no physical store',
    'Results may vary per individual',
    'Requires consistent effort to see best results',
  ].map(c => `<li>${c}</li>`).join('\n')
}

export interface BridgeRenderInput {
  campaignId: string
  productName: string
  niche: string
  primaryKeyword: string
  hoplink: string
  headlineA: string
  headlineB: string
  subHeadline: string
  angle: string
  benefits: string[]
  painPoints: string[]
  trustSignals: string[]
  faqItems: Array<{ question: string; answer: string }>
  leadMagnetTitle: string
  leadMagnetUrl: string
  leadMagnetId: string | null
}

export interface BridgeRenderResult {
  variantA: { bridgePageId: string; slug: string; templateId: string; html: string }
  variantB: { bridgePageId: string; slug: string; templateId: string; html: string }
}

/**
 * Renders both A/B bridge page variants and persists them to the database.
 * Returns the rendered HTML strings and their DB record IDs.
 */
export async function renderBridgePages(input: BridgeRenderInput): Promise<BridgeRenderResult> {
  const templateId = pickTemplate(input.niche)
  const colors = pickColors(input.niche)
  const baseSlug = slugify(input.productName || input.primaryKeyword)
  const year = new Date().getFullYear().toString()

  // Try to parse FAQ from JSON if it's a string
  let faqItems = input.faqItems
  if (!Array.isArray(faqItems) || faqItems.length === 0) {
    faqItems = [
      { question: `What is ${input.primaryKeyword}?`, answer: `${input.primaryKeyword} refers to ${input.productName} and the methods it uses to deliver results. It's designed to help beginners and experienced users alike achieve consistent outcomes.` },
      { question: `Is ${input.productName} worth it?`, answer: `Based on our analysis, ${input.productName} delivers ${input.benefits[0] || 'proven results'}. The money-back guarantee means there's no financial risk in trying it.` },
      { question: `How long does it take to see results?`, answer: `Most users begin seeing early indicators within 2-4 weeks. Full results typically emerge within 60-90 days of consistent application.` },
      { question: `Do I need any experience?`, answer: `No. ${input.productName} was designed with beginners in mind. The step-by-step format guides you through every stage.` },
    ]
  }

  const sharedVars: Record<string, string> = {
    '{{META_TITLE}}': `${input.headlineA} | ${input.productName} Review`,
    '{{META_DESCRIPTION}}': input.subHeadline.slice(0, 158),
    '{{NICHE_BG}}': colors.bg,
    '{{NICHE_ACCENT}}': colors.accent,
    '{{NICHE_LABEL}}': input.niche,
    '{{PRODUCT_NAME}}': input.productName,
    '{{PRIMARY_KEYWORD}}': input.primaryKeyword,
    '{{HOPLINK}}': input.hoplink,
    '{{SUB_HEADLINE}}': input.subHeadline,
    '{{CTA_TEXT}}': `Get ${input.productName} Now`,
    '{{TRUST_SIGNALS}}': trustBarSpans(input.trustSignals),
    '{{LEAD_MAGNET_TITLE}}': input.leadMagnetTitle,
    '{{LEAD_MAGNET_SHORT}}': input.leadMagnetTitle.split(' ').slice(0, 3).join(' '),
    '{{LEAD_MAGNET_URL}}': input.leadMagnetUrl,
    '{{TESTIMONIALS}}': buildTestimonials(input.productName, input.primaryKeyword, input.benefits),
    '{{TESTIMONIAL_HEADLINE}}': `People Are Getting Results with ${input.primaryKeyword}`,
    '{{PAIN_POINTS}}': buildPainList(input.painPoints),
    '{{OPTIN_BULLETS}}': buildOptinBullets(input.benefits),
    '{{BENEFIT_BULLETS}}': buildBenefitBullets(input.benefits),
    '{{PROS_LIST}}': buildProsItems(input.benefits),
    '{{CONS_LIST}}': buildConsItems(),
    '{{REVIEW_SUMMARY}}': `After extensive testing, ${input.productName} stands out as one of the most effective solutions we've reviewed for ${input.primaryKeyword}. ${input.angle}`,
    '{{PROBLEM_HEADLINE}}': `Why Most People Struggle with ${input.primaryKeyword}`,
    '{{PROBLEM_BODY_1}}': `If you've been searching for a solution to ${input.primaryKeyword}, you already know the frustration. ${input.painPoints[0] || 'Most approaches fail because they miss the root cause'}.`,
    '{{PROBLEM_BODY_2}}': `The real issue isn't effort — it's strategy. And that's exactly what ${input.productName} addresses directly.`,
    '{{AGITATE_CALLOUT}}': `The longer you wait, the harder it gets. Every day without the right approach to ${input.primaryKeyword} is a day of missed potential.`,
    '{{SOLUTION_TEASE}}': `${input.productName} changes this — here's how`,
    '{{SOLUTION_HEADLINE}}': `How ${input.productName} Solves This`,
    '{{SOLUTION_BODY_1}}': `${input.productName} was built specifically to address the root cause of why people struggle with ${input.primaryKeyword}. ${input.angle}`,
    '{{SOLUTION_BODY_2}}': `The results speak for themselves. ${input.benefits[0] || 'Users consistently report measurable improvements'} within the first few weeks.`,
    '{{MECHANISM_EXPLANATION}}': `${input.productName} works by ${input.benefits.slice(0, 2).join(' and ')}. This creates a compounding effect that builds momentum over time.`,
    '{{SOLUTION_STEPS}}': buildSolutionSteps(input.benefits),
    '{{BRIDGE_HEADLINE}}': `Ready to Get Results with ${input.primaryKeyword}?`,
    '{{BRIDGE_BODY_1}}': `${input.productName} is the logical next step for anyone serious about ${input.primaryKeyword}. ${input.angle}`,
    '{{BRIDGE_BODY_2}}': `The 60-day money-back guarantee means there's absolutely no risk. If you don't see results, you don't pay.`,
    '{{GUARANTEE_TITLE}}': '60-Day Money-Back Guarantee',
    '{{GUARANTEE_BODY}}': `If you try ${input.productName} and don't see results within 60 days, contact support and receive a full refund — no questions asked.`,
    '{{FAQ_ITEMS}}': buildFAQItems(faqItems),
    '{{COMPARISON_ROWS}}': buildComparisonRows(input.benefits),
    '{{TIMELINE_STEPS}}': buildTimelineSteps(input.benefits),
    '{{STORY_OPENING}}': `I remember the exact moment I decided something had to change. ${input.painPoints[0] || 'I had tried everything and nothing was working'}.`,
    '{{STORY_STRUGGLE}}': `The problem wasn't that I wasn't trying hard enough. The problem was that I was using the wrong approach for ${input.primaryKeyword}.`,
    '{{PULL_QUOTE}}': `"${input.angle}"`,
    '{{STORY_DISCOVERY}}': `That's when I discovered ${input.productName}. I was skeptical — I'd been burned before. But something felt different this time.`,
    '{{STORY_TURNING_POINT}}': `Within a few weeks of using ${input.productName}, I started to see real changes. ${input.benefits[0] || 'The results were undeniable'}.`,
    '{{AUTHOR_NAME}}': 'The Team',
    '{{POST_DATE}}': new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    '{{YEAR}}': year,
    '{{BRAND_NAME}}': input.productName,
    '{{PHYSICAL_ADDRESS}}': '123 Main St, Suite 100, Austin TX 78701',
    '{{CAMPAIGN_ID}}': input.campaignId,
    '{{BRIDGE_PAGE_ID}}': '', // filled per variant below
  }

  // Load the template once
  const templatePath = path.join(TEMPLATES_DIR, `${templateId}.html`)
  let templateHtml: string
  try {
    templateHtml = readFileSync(templatePath, 'utf8')
  } catch {
    // Fallback to problem-solution if template file is missing
    templateHtml = readFileSync(path.join(TEMPLATES_DIR, 'problem-solution.html'), 'utf8')
  }

  function renderVariant(headline: string, slug: string, bridgePageId: string): string {
    const vars = {
      ...sharedVars,
      '{{HEADLINE_A}}': headline,
      '{{BRIDGE_PAGE_ID}}': bridgePageId,
    }
    return Object.entries(vars).reduce((html, [key, val]) => {
      // Replace all occurrences of the placeholder
      return html.split(key).join(val)
    }, templateHtml)
  }

  const slugA = `${baseSlug}-a`
  const slugB = `${baseSlug}-b`

  // Persist variant A
  const dbA = await prisma.bridgePage.create({
    data: {
      campaignId: input.campaignId,
      slug: slugA,
      templateId,
      leadMagnetId: input.leadMagnetId,
      publishedAt: new Date(),
      contentJson: {
        headline: input.headlineA,
        abVariant: 'A',
        niche: input.niche,
        templateId,
      } as object,
    },
  })

  // Persist variant B
  const dbB = await prisma.bridgePage.create({
    data: {
      campaignId: input.campaignId,
      slug: slugB,
      templateId,
      leadMagnetId: input.leadMagnetId,
      publishedAt: new Date(),
      contentJson: {
        headline: input.headlineB,
        abVariant: 'B',
        niche: input.niche,
        templateId,
      } as object,
    },
  })

  const htmlA = renderVariant(input.headlineA, slugA, dbA.id)
  const htmlB = renderVariant(input.headlineB, slugB, dbB.id)

  // Update the contentJson with the rendered HTML stored inline for serving
  await prisma.bridgePage.update({
    where: { id: dbA.id },
    data: {
      contentJson: {
        headline: input.headlineA,
        abVariant: 'A',
        niche: input.niche,
        templateId,
        renderedHtml: htmlA,
      } as object,
    },
  })

  await prisma.bridgePage.update({
    where: { id: dbB.id },
    data: {
      contentJson: {
        headline: input.headlineB,
        abVariant: 'B',
        niche: input.niche,
        templateId,
        renderedHtml: htmlB,
      } as object,
    },
  })

  return {
    variantA: { bridgePageId: dbA.id, slug: slugA, templateId, html: htmlA },
    variantB: { bridgePageId: dbB.id, slug: slugB, templateId, html: htmlB },
  }
}
