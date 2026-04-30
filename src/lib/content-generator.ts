/**
 * Content Generator — Sprint 4
 *
 * Generates all 12 content types from the content brief using Mistral via
 * OpenRouter with rule-based fallbacks. Every type uses the brief as
 * direct context rather than writing blind.
 *
 * 12 content types:
 *  1.  bridge_page       — bridge page copy (2 headline variants)
 *  2.  article_devto     — full SEO article for dev.to
 *  3.  article_hashnode  — full SEO article for Hashnode
 *  4.  article_blogger   — full SEO article for Blogger
 *  5.  article_tumblr    — shorter adapted article for Tumblr
 *  6.  pinterest_captions— 3 structured pin objects ({title, description, hashtags})
 *  7.  telegram_posts    — 10 Telegram posts (carousel series)
 *  8.  email_sequence    — 7 emails + 3 re-engage emails (JSON array)
 *  9.  lead_magnet       — lead magnet body (7-12 page HTML)
 * 10.  faq_block         — 8 FAQ Q&As (JSON for schema markup)
 * 11.  headlines         — 10 headline variants
 * 12.  cta_variants      — 5 CTA button copy variants
 */

import type { ContentBrief } from './content-brief'
import { callMistral } from './mistral'

export interface GeneratedContent {
  type: string
  text: string
  html?: string
}

interface OfferContext {
  productName: string
  niche: string
  angle: string
  targetAudience: string[]
  painPoints: string[]
  benefits: string[]
  trustSignals: string[]
  hoplink: string
  primaryKeyword: string
  secondaryKeywords: string[]
}

// ─── LLM call helper ─────────────────────────────────────────────────────────

async function callLLM(prompt: string, size: 'large' | 'small' = 'small'): Promise<string> {
  return callMistral(prompt, size)
}

// ─── 1. Bridge Page ───────────────────────────────────────────────────────────

function bridgePageFallback(brief: ContentBrief, offer: OfferContext): string {
  const { primaryKeyword, proposedTitle, mandatoryEntities, lsiTerms, faqQuestions } = brief
  const { productName, angle, painPoints, benefits, trustSignals, hoplink } = offer

  const headline1 = proposedTitle
  const headline2 = `Why ${productName} Is the ${primaryKeyword.split(' ').slice(-1)[0]} Solution You've Been Waiting For`

  const faqs = (faqQuestions || []).slice(0, 4).map(q =>
    `<dt>${q}</dt><dd>Most people trying to ${primaryKeyword} make the mistake of overlooking ${(mandatoryEntities[0] || primaryKeyword)}. ${productName} solves this directly.</dd>`
  ).join('\n')

  const benefitBullets = benefits.map(b => `<li>✅ ${b}</li>`).join('\n')
  const painBullets = painPoints.map(p => `<li>❌ ${p}</li>`).join('\n')
  const lsiList = lsiTerms.slice(0, 5).join(', ')

  return `<!-- Bridge Page: ${productName} | ${primaryKeyword} -->
<h1>${headline1}</h1>
<p class="sub">${angle}</p>

<section class="pain">
<h2>Are You Struggling With Any of These?</h2>
<ul>${painBullets}</ul>
</section>

<section class="solution">
<h2>Here's What Actually Works</h2>
<p>If you've been searching for ${primaryKeyword} — and tried everything — there's one thing most guides never tell you about ${lsiList}.</p>
<p>${productName} is built specifically for ${offer.targetAudience[0] || 'people like you'}.</p>
</section>

<section class="benefits">
<h2>What You'll Get</h2>
<ul>${benefitBullets}</ul>
${trustSignals.map(t => `<p class="trust">🛡️ ${t}</p>`).join('\n')}
</section>

<section class="opt-in">
<h2>Get Your Free Guide — Instant Access</h2>
<form>
<input type="text" placeholder="First Name" required />
<input type="email" placeholder="Email Address" required />
<button type="submit">YES — Send My Free Guide →</button>
</form>
<p class="micro">No spam. Unsubscribe anytime.</p>
</section>

<section class="bridge">
<h2>Ready to Take the Next Step?</h2>
<p>Once you've downloaded the guide, ${productName} is the natural next step for anyone serious about results.</p>
<a href="${hoplink}" class="cta-btn">See ${productName} Now →</a>
</section>

<section class="faq">
<h2>Frequently Asked Questions</h2>
<dl>${faqs}</dl>
</section>

<!-- Variant Headline 2: ${headline2} -->`
}

async function generateBridgePage(brief: ContentBrief, offer: OfferContext): Promise<string> {
  const prompt = `You are an expert affiliate marketer and copywriter.
Write a complete bridge page for the affiliate offer below. Use PAS (Problem-Agitate-Solve) framework.
Include: H1 headline + sub-headline variant, pain agitation section, solution reveal, 4 benefit bullets, opt-in section, bridge section, 4 FAQ Q&As.
Return raw HTML with semantic section tags.

OFFER: ${offer.productName}
NICHE: ${offer.niche}
ANGLE: ${offer.angle}
PRIMARY KEYWORD: ${brief.primaryKeyword}
TARGET AUDIENCE: ${offer.targetAudience.join(', ')}
PAIN POINTS: ${offer.painPoints.join(', ')}
BENEFITS: ${offer.benefits.join(', ')}
TRUST SIGNALS: ${offer.trustSignals.join(', ')}
MANDATORY ENTITIES: ${brief.mandatoryEntities.slice(0, 6).join(', ')}
TARGET WORD COUNT: ${brief.targetWordCount}
PROPOSED TITLE: ${brief.proposedTitle}
FAQ QUESTIONS: ${(brief.faqQuestions || []).slice(0, 4).join(' | ')}

Write the bridge page HTML now:`

  try {
    const html = await callLLM(prompt, 'large')
    return html || bridgePageFallback(brief, offer)
  } catch {
    return bridgePageFallback(brief, offer)
  }
}

// ─── 2-5. Platform Articles ───────────────────────────────────────────────────

function articleFallback(brief: ContentBrief, offer: OfferContext, platform: string): string {
  const { primaryKeyword, proposedTitle, proposedMetaDescription, targetWordCount, suggestedOutline, mandatoryEntities, lsiTerms, faqQuestions } = brief
  const { productName, angle, benefits, painPoints, hoplink } = offer

  const intro = `If you've been looking for the best way to understand ${primaryKeyword}, you're not alone. Thousands of people every month search for exactly this — and most guides leave them more confused than when they started.\n\nIn this guide, we break down everything you need to know about ${primaryKeyword}, including ${(mandatoryEntities.slice(0, 3)).join(', ')}, and why most people overlook the key factor that actually drives results.\n\nHere's what we'll cover:\n- How ${primaryKeyword} actually works\n- The #1 mistake people make\n- What ${productName} does differently`

  const sections = (suggestedOutline || []).map(s => {
    if (s.level === 'h1') return `# ${s.text}\n\n${proposedMetaDescription}\n`
    if (s.level === 'h2') return `## ${s.text}\n\n${s.notes || ''} This section covers approximately ${s.targetWords || 300} words on ${s.text.toLowerCase()}.\n`
    return `### ${s.text}\n\n${s.notes || ''}\n`
  }).join('\n')

  const faqs = (faqQuestions || []).slice(0, 8).map((q, i) => {
    const answers = [
      `The most important thing to understand about ${q.toLowerCase().replace(/^(what|how|why|when|where|is|can|does|do|will|should)\s+/i, '')} is that it depends on ${mandatoryEntities[i % mandatoryEntities.length] || primaryKeyword}. Most experts agree: consistent action beats perfect strategy every time.`,
      `Great question. When it comes to ${primaryKeyword}, ${productName} addresses this directly by focusing on ${benefits[0] || 'proven results'}. The short answer: yes, if you follow the system.`,
      `The difference between people who succeed and those who don't with ${primaryKeyword} usually comes down to one thing: ${lsiTerms[i % Math.max(lsiTerms.length, 1)] || 'consistency'}. Start there.`,
    ]
    return `**Q: ${q}**\n\nA: ${answers[i % 3]}`
  }).join('\n\n')

  const platformNote = platform === 'tumblr'
    ? `*Originally published on our research blog. Check out [${productName}](${hoplink}) for the full system.*`
    : `> *Disclosure: This article contains affiliate links. We may earn a commission at no extra cost to you.*`

  return `# ${proposedTitle}\n\n${platformNote}\n\n${proposedMetaDescription}\n\n---\n\n## Introduction\n\n${intro}\n\n${sections}\n\n## Frequently Asked Questions\n\n${faqs}\n\n## Conclusion\n\nIf you're serious about ${primaryKeyword}, the path forward is clear. Start with what you've learned here, and when you're ready to accelerate your results, [${productName}](${hoplink}) is the logical next step.\n\n*Keywords: ${[primaryKeyword, ...brief.secondaryKeywords.slice(0, 3)].join(', ')}*`
}

async function generateArticle(brief: ContentBrief, offer: OfferContext, platform: string): Promise<string> {
  const wordTarget = platform === 'tumblr' ? 600 : brief.targetWordCount
  const prompt = `You are an expert SEO content writer creating a ${wordTarget}-word affiliate marketing article for ${platform}.
Use the content brief below. Maintain natural, human-sounding prose. Include all mandatory entities naturally.
Write in Markdown format. Include H1, H2, H3 headings, an introduction, main sections per the outline, FAQ section with 8 Q&As, and conclusion.

TITLE: ${brief.proposedTitle}
META DESCRIPTION: ${brief.proposedMetaDescription}
PRIMARY KEYWORD: ${brief.primaryKeyword}
SECONDARY KEYWORDS: ${brief.secondaryKeywords.join(', ')}
TARGET WORDS: ${wordTarget}
PRODUCT: ${offer.productName}
ANGLE: ${offer.angle}
MANDATORY ENTITIES (must include ALL): ${brief.mandatoryEntities.join(', ')}
LSI TERMS (use naturally): ${brief.lsiTerms.slice(0, 8).join(', ')}
OUTLINE: ${(brief.suggestedOutline || []).map(s => `${s.level}: ${s.text}`).join(' | ')}
FAQ QUESTIONS: ${(brief.faqQuestions || []).join(' | ')}
AFFILIATE LINK: ${offer.hoplink}

Write the full article now:`

  try {
    const text = await callLLM(prompt, 'large')
    return text || articleFallback(brief, offer, platform)
  } catch {
    return articleFallback(brief, offer, platform)
  }
}

// ─── 6. Pinterest Captions ────────────────────────────────────────────────────

function pinterestFallback(brief: ContentBrief, offer: OfferContext): string {
  const { primaryKeyword } = brief
  const { productName, benefits } = offer
  const tag = primaryKeyword.replace(/\s+/g, '')

  const pins = [
    {
      title: `The ${primaryKeyword} Guide That Actually Works`,
      description: `Struggling with ${primaryKeyword}? ${benefits[0] || 'Real results'} — discover the system no one talks about. Save this pin!`,
      hashtags: [tag, 'affiliateTips', 'onlineIncome'],
    },
    {
      title: `#1 Mistake With ${primaryKeyword} (And How to Fix It)`,
      description: `Most people skip this step with ${primaryKeyword}. ${productName} shows you exactly what works. Link in bio.`,
      hashtags: [tag, productName.replace(/\s+/g, ''), 'tips'],
    },
    {
      title: `${primaryKeyword} — Complete Breakdown`,
      description: `Everything you need to know about ${primaryKeyword} in one place. Save for later and share with anyone who needs this!`,
      hashtags: [tag, 'learnOnline', 'saveForLater'],
    },
  ]
  return JSON.stringify(pins, null, 2)
}

async function generatePinterestCaptions(brief: ContentBrief, offer: OfferContext): Promise<string> {
  const prompt = `Create exactly 3 Pinterest pin objects for an affiliate marketing campaign about: ${brief.primaryKeyword}

Product: ${offer.productName}
Niche: ${offer.niche}
Benefits: ${offer.benefits.slice(0, 3).join(', ')}

Rules:
- title: 40-60 chars, benefit-driven, no clickbait
- description: 100-150 chars, includes keyword naturally, ends with a call-to-action or hook
- hashtags: array of 3-4 strings (no # prefix, no spaces in tags)

Return a JSON array of 3 objects: [{"title": "...", "description": "...", "hashtags": ["..."]}, ...]`

  try {
    const raw = await callLLM(prompt)
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) return match[0]
    return pinterestFallback(brief, offer)
  } catch {
    return pinterestFallback(brief, offer)
  }
}

// ─── 7. Telegram Posts ────────────────────────────────────────────────────────

function telegramFallback(brief: ContentBrief, offer: OfferContext): string {
  const { primaryKeyword, faqQuestions } = brief
  const { productName, benefits, painPoints, angle } = offer

  const posts = [
    `💡 *Quick tip on ${primaryKeyword}*\n\nMost people never hear this. The difference between struggling and succeeding? ${benefits[0] || 'Consistency'}.\n\n#${primaryKeyword.replace(/\s+/g, '')}`,
    `❌ *The #1 mistake with ${primaryKeyword}*\n\n${painPoints[0] || 'Trying to do everything at once'}.\n\nHere's what works instead 👇`,
    `✅ *${productName} update*\n\n${angle}\n\nHave you tried it yet? Drop a 🙋 if this resonates.`,
    `📊 *By the numbers*\n\nPeople who consistently apply the ${primaryKeyword} principles see results within weeks — not months.\n\nWhat's your timeline? 💬`,
    `🔥 *Hot take*\n\nMost ${primaryKeyword} guides are written by people who've never actually done it.\n\nReal results come from ${benefits[1] || 'proven systems'}. Period.`,
    `💬 *Community question*\n\n${(faqQuestions || [`What's your biggest challenge with ${primaryKeyword}?`])[0]}\n\nReply below 👇`,
    `🎯 *Focus point for this week*\n\nIf you only work on ONE thing with ${primaryKeyword} this week, make it ${benefits[0] || 'building consistency'}.\n\n#focus #results`,
    `📖 *Quick win*\n\nSpend 15 minutes today reviewing your ${primaryKeyword} approach. One small tweak can change everything.\n\nTag someone who needs this 👇`,
    `⚡ *Reminder*\n\nYou're one decision away from different results. ${productName} is still available — but this won't last.\n\n[Click the link in bio to get access]`,
    `🙏 *Final thought*\n\nSuccess with ${primaryKeyword} isn't about being perfect. It's about showing up.\n\nSee you tomorrow with more tips. Stay consistent 💪`,
  ]
  return JSON.stringify(posts, null, 2)
}

async function generateTelegramPosts(brief: ContentBrief, offer: OfferContext): Promise<string> {
  const prompt = `Write exactly 10 Telegram channel posts for a 10-day series about: ${brief.primaryKeyword}
Product being promoted: ${offer.productName}
Angle: ${offer.angle}

Each post should be 50-120 words, use emojis naturally, build curiosity or deliver value, vary the format (tip / question / story / data point / reminder).
Use Telegram Markdown (*bold*, _italic_).
Return a JSON array of 10 strings only.`

  try {
    const raw = await callLLM(prompt)
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) return match[0]
    return telegramFallback(brief, offer)
  } catch {
    return telegramFallback(brief, offer)
  }
}

// ─── 8. Email Sequence ────────────────────────────────────────────────────────

function emailFallback(brief: ContentBrief, offer: OfferContext): string {
  const { primaryKeyword } = brief
  const { productName, angle, benefits, painPoints, hoplink } = offer

  const sequence = [
    {
      day: 0,
      subject: `Your free guide is inside 📩`,
      body: `Hey {{first_name}},\n\nYou just made a smart move.\n\nYour free guide on ${primaryKeyword} is attached — but before you dive in, I want to share something important.\n\nMost people who struggle with ${primaryKeyword} are making one critical mistake: ${painPoints[0] || 'skipping the fundamentals'}.\n\nYour guide covers this head-on. Read it tonight.\n\nTalk soon,\n[Your Name]`
    },
    {
      day: 1,
      subject: `Did you get a chance to read it?`,
      body: `Hey {{first_name}},\n\nJust checking in — did you read your ${primaryKeyword} guide?\n\nHere's what I want you to focus on from page 1: ${benefits[0] || 'the core principle'}.\n\nOne reader told me: "I wish I'd known this years ago."\n\nTomorrow I'll share something even more valuable.\n\n[Your Name]`
    },
    {
      day: 2,
      subject: `The thing nobody tells you about ${primaryKeyword}`,
      body: `Hey {{first_name}},\n\n${angle}\n\nHere's what I mean. Most guides tell you what to do. Very few tell you *why* most people fail.\n\nThe answer: ${painPoints[1] || 'inconsistency'}.\n\n${benefits[1] || 'The system I recommend'} fixes this directly.\n\nMore tomorrow.\n[Your Name]`
    },
    {
      day: 3,
      subject: `Real results — see what's possible`,
      body: `Hey {{first_name}},\n\nI want to show you something.\n\n${productName} has helped thousands of people with ${primaryKeyword}.\n\nHere's what they consistently report: ${benefits.slice(0, 3).join(', ')}.\n\nIf you haven't checked it out yet: ${hoplink}\n\n[Your Name]`
    },
    {
      day: 5,
      subject: `Quick question for you`,
      body: `Hey {{first_name}},\n\nDo you have 3 minutes?\n\nI want to ask you something: what's your #1 challenge with ${primaryKeyword} right now?\n\nHit reply and tell me. I read every response.\n\n[Your Name]`
    },
    {
      day: 7,
      subject: `This is the last thing I'll say about this`,
      body: `Hey {{first_name}},\n\nI don't like pushy emails. So I'll keep this simple.\n\nIf ${primaryKeyword} is something you're serious about, ${productName} is the tool I'd recommend.\n\nHere's why: ${benefits[0]}. And unlike most options, it also delivers ${benefits[1] || 'real, lasting results'}.\n\n[Check it out here] ${hoplink}\n\n[Your Name]`
    },
    {
      day: 10,
      subject: `Value drop — use this today`,
      body: `Hey {{first_name}},\n\nNo pitch today. Just a tip.\n\nThe single fastest way to improve your ${primaryKeyword} results: focus on one thing for 30 days.\n\nNot three things. One.\n\nTry it and let me know how it goes.\n\n[Your Name]`
    },
    {
      day: 14,
      subject: `Re-engage: still interested in ${primaryKeyword}?`,
      type: 're-engage',
      body: `Hey {{first_name}},\n\nHaven't heard from you in a while — totally okay.\n\nJust wanted to check in. Are you still working on ${primaryKeyword}?\n\nIf yes, I have a few new resources that might help. Hit reply and I'll send them over.\n\nIf not — no worries at all. You can unsubscribe below anytime.\n\n[Your Name]`
    },
    {
      day: 17,
      subject: `One more resource for you`,
      type: 're-engage',
      body: `Hey {{first_name}},\n\nIf you saw my last email and meant to reply but life got busy — totally understand.\n\nHere's something concrete: ${benefits[0]}. That's what ${productName} delivers.\n\n[Link] ${hoplink}\n\nIf you're done, no hard feelings — unsubscribe link below.\n\n[Your Name]`
    },
    {
      day: 21,
      subject: `Last email — I promise`,
      type: 're-engage',
      body: `Hey {{first_name}},\n\nThis is my last check-in about ${primaryKeyword}.\n\nIf you ever want to pick this back up, I'll be here. The resources don't expire.\n\n[Your Name]\n\nP.S. — ${productName} is still available at ${hoplink} if you ever decide to take the leap.`
    },
  ]
  return JSON.stringify(sequence, null, 2)
}

async function generateEmailSequence(brief: ContentBrief, offer: OfferContext): Promise<string> {
  const prompt = `Write a 10-email affiliate email sequence (7 main + 3 re-engage) for:
Product: ${offer.productName}
Niche: ${offer.niche}
Primary Keyword: ${brief.primaryKeyword}
Angle: ${offer.angle}
Benefits: ${offer.benefits.join(', ')}
Pain Points: ${offer.painPoints.join(', ')}
Affiliate link: ${offer.hoplink}

Return a JSON array of 10 objects, each with: day (number), subject (string), body (string), and optionally type:"re-engage" for emails 8-10.
Write naturally — no em dashes for bullet points, conversational tone, avoid sounding like ChatGPT.`

  try {
    const raw = await callLLM(prompt)
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) return match[0]
    return emailFallback(brief, offer)
  } catch {
    return emailFallback(brief, offer)
  }
}

// ─── 9. Lead Magnet ───────────────────────────────────────────────────────────

function leadMagnetFallback(brief: ContentBrief, offer: OfferContext): string {
  const { primaryKeyword, mandatoryEntities, lsiTerms, faqQuestions } = brief
  const { productName, benefits, painPoints, hoplink, niche } = offer

  const coreBullets = benefits.map((b, i) => `<li><strong>Step ${i + 1}:</strong> ${b}</li>`).join('\n')
  const entityList = mandatoryEntities.slice(0, 6).map(e => `<li>${e}</li>`).join('\n')
  const faqs = (faqQuestions || []).slice(0, 4).map(q => `<h3>${q}</h3><p>The key to answering this comes down to ${lsiTerms[0] || primaryKeyword}. Focus on consistency and the results follow.</p>`).join('\n')

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${primaryKeyword} — Complete Guide</title>
<style>body{font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:40px;color:#1E293B;} h1{color:#0F172A;} h2{color:#1E40AF;border-bottom:2px solid #E2E8F0;padding-bottom:8px;} .cover{background:linear-gradient(135deg,#1E40AF,#7C3AED);color:#fff;padding:60px 40px;border-radius:12px;text-align:center;margin-bottom:40px;} .cta{background:#F97316;color:#fff;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;margin:20px 0;} .disclaimer{font-size:12px;color:#94A3B8;margin-top:60px;border-top:1px solid #E2E8F0;padding-top:20px;}</style>
</head>
<body>

<div class="cover">
<h1>The Complete ${primaryKeyword} Guide</h1>
<p>Everything you need to get started — and get results</p>
</div>

<h2>Welcome</h2>
<p>Thank you for downloading this guide. By the time you finish reading, you'll have a clear understanding of ${primaryKeyword} and a concrete action plan to move forward.</p>
<p>This guide covers: ${mandatoryEntities.slice(0, 3).join(', ')}.</p>

<h2>The #1 Mistake People Make</h2>
<p>${painPoints[0] || 'Most people approach ' + primaryKeyword + ' without a clear framework'}. This leads to frustration, wasted time, and poor results. The good news: it's completely avoidable.</p>
<p>The solution is understanding that ${lsiTerms[1] || primaryKeyword} requires a systematic approach — not random tactics.</p>

<h2>Core Principles</h2>
<p>Everything in ${primaryKeyword} comes back to these fundamentals:</p>
<ul>${entityList}</ul>

<h2>Your Action Plan</h2>
<ol>${coreBullets}</ol>

<h2>Frequently Asked Questions</h2>
${faqs}

<h2>What's Next</h2>
<p>You've now got the foundation. The next step is implementing a proven system that handles the hard parts for you.</p>
<p>${productName} was built specifically for people who are serious about ${niche} results. It removes the guesswork and gives you a clear path to follow.</p>
<p style="text-align:center"><a class="cta" href="${hoplink}">See ${productName} Now →</a></p>
<p style="text-align:center;font-size:14px;">Takes 60 seconds to get started.</p>

<div class="disclaimer">
<p><strong>Affiliate Disclosure:</strong> This guide contains affiliate links. If you purchase through these links, we may earn a commission at no additional cost to you. We only recommend products we believe in.</p>
<p><strong>Results Disclaimer:</strong> Individual results may vary. The testimonials and examples used are exceptional results and are not intended to represent or guarantee that anyone will achieve the same or similar results.</p>
</div>

</body>
</html>`
}

async function generateLeadMagnet(brief: ContentBrief, offer: OfferContext): Promise<string> {
  const prompt = `Write a complete lead magnet HTML document (7-12 pages equivalent) about: ${brief.primaryKeyword}
Product to pre-sell: ${offer.productName} | Link: ${offer.hoplink}
Niche: ${offer.niche}

Include: cover page, welcome section, #1 mistake section, 3-4 core content sections with actionable tips, FAQ section (4 Q&As), "What's Next" section with soft pitch to ${offer.productName}, affiliate disclosure footer.
Write in complete HTML with inline CSS. Professional, clean design. Content should be genuinely useful — not fluff.
Mandatory entities to include naturally: ${brief.mandatoryEntities.join(', ')}`

  try {
    const html = await callLLM(prompt, 'large')
    if (html.includes('<html') || html.includes('<body')) return html
    return leadMagnetFallback(brief, offer)
  } catch {
    return leadMagnetFallback(brief, offer)
  }
}

// ─── 10. FAQ Block ────────────────────────────────────────────────────────────

function faqFallback(brief: ContentBrief, offer: OfferContext): string {
  const { primaryKeyword, faqQuestions, mandatoryEntities, lsiTerms } = brief
  const { productName, benefits } = offer

  const questions = faqQuestions && faqQuestions.length >= 8
    ? faqQuestions.slice(0, 8)
    : [
        `What is ${primaryKeyword}?`,
        `How does ${primaryKeyword} work?`,
        `Is ${productName} worth it?`,
        `How long does it take to see results with ${primaryKeyword}?`,
        `What makes ${primaryKeyword} different from other approaches?`,
        `Who is ${primaryKeyword} best for?`,
        `Can beginners use ${productName}?`,
        `What results can I expect?`,
        ...(faqQuestions || []),
      ].slice(0, 8)

  const answers = [
    `${primaryKeyword} refers to ${mandatoryEntities[0] || 'the systematic approach'}. It encompasses ${lsiTerms.slice(0, 2).join(', ')} and is used by thousands of people to achieve consistent results.`,
    `The process involves ${mandatoryEntities.slice(0, 3).join(', ')}. Once you understand these core components, the path forward becomes clear.`,
    `Based on our analysis, ${productName} delivers ${benefits[0]} and ${benefits[1] || 'proven results'}. For anyone serious about ${primaryKeyword}, it's a worthwhile investment.`,
    `Most users begin seeing early indicators within 2-4 weeks. Full results typically emerge within 60-90 days of consistent application.`,
    `The key differentiator is the focus on ${mandatoryEntities[0] || primaryKeyword} rather than surface-level tactics. This produces sustainable, long-term outcomes.`,
    `${primaryKeyword} works best for ${offer.targetAudience[0] || 'motivated individuals'} who are ready to commit to a proven process rather than shortcuts.`,
    `Yes. ${productName} was designed with beginners in mind. The step-by-step format means no prior experience is required.`,
    `Users consistently report: ${benefits.slice(0, 3).join(', ')}. Individual results vary based on effort and consistency.`,
  ]

  const faqs = questions.map((q, i) => ({ question: q, answer: answers[i % answers.length] }))
  return JSON.stringify(faqs, null, 2)
}

async function generateFAQBlock(brief: ContentBrief, offer: OfferContext): Promise<string> {
  const prompt = `Generate exactly 8 FAQ Q&As for SEO schema markup about: ${brief.primaryKeyword}
Product: ${offer.productName}
Niche: ${offer.niche}

Rules: questions should be natural search queries, answers 50-120 words each, include relevant keywords naturally, avoid AI-sounding phrases.
Return JSON array of 8 objects: [{question: "...", answer: "..."}, ...]`

  try {
    const raw = await callLLM(prompt)
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) return match[0]
    return faqFallback(brief, offer)
  } catch {
    return faqFallback(brief, offer)
  }
}

// ─── 11. Headlines ────────────────────────────────────────────────────────────

function headlinesFallback(brief: ContentBrief, offer: OfferContext): string {
  const { primaryKeyword } = brief
  const { productName } = offer

  return JSON.stringify([
    `How to ${primaryKeyword} — The Complete 2026 Guide`,
    `The Truth About ${primaryKeyword} Nobody Tells You`,
    `${primaryKeyword}: What Actually Works (And What Doesn't)`,
    `I Tried Every Method for ${primaryKeyword} — Here's What Won`,
    `Why Most People Fail at ${primaryKeyword} (And How to Be Different)`,
    `${productName} Review: Does It Really Help With ${primaryKeyword}?`,
    `The ${primaryKeyword} Mistake That's Costing You Results`,
    `Step-by-Step: ${primaryKeyword} for Complete Beginners`,
    `${primaryKeyword} in 30 Days: A Real Case Study`,
    `Forget Everything You Know About ${primaryKeyword} — Read This First`,
  ], null, 2)
}

async function generateHeadlines(brief: ContentBrief, offer: OfferContext): Promise<string> {
  const prompt = `Write exactly 10 compelling headline variants for content about: ${brief.primaryKeyword}
Product: ${offer.productName}

Mix formats: how-to, curiosity gap, listicle, review, case study, mistake-reveal.
Each headline 50-65 characters. No clickbait. Return a JSON array of 10 strings.`

  try {
    const raw = await callLLM(prompt)
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) return match[0]
    return headlinesFallback(brief, offer)
  } catch {
    return headlinesFallback(brief, offer)
  }
}

// ─── 12. CTA Variants ─────────────────────────────────────────────────────────

function ctaFallback(offer: OfferContext): string {
  const { productName } = offer
  return JSON.stringify([
    `Get Instant Access to ${productName} →`,
    `Yes — I Want Real Results →`,
    `Show Me How It Works →`,
    `Start My Journey Today →`,
    `Claim My Spot Now →`,
  ], null, 2)
}

async function generateCTAVariants(brief: ContentBrief, offer: OfferContext): Promise<string> {
  const prompt = `Write exactly 5 CTA (call-to-action) button copy variants for an affiliate offer.
Product: ${offer.productName}
Keyword: ${brief.primaryKeyword}
Niche: ${offer.niche}

Rules: action-oriented, first person (I/My), max 40 chars each, urgency or benefit focus, no generic "Click Here".
Return a JSON array of 5 strings.`

  try {
    const raw = await callLLM(prompt)
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) return match[0]
    return ctaFallback(offer)
  } catch {
    return ctaFallback(offer)
  }
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export type ContentType =
  | 'bridge_page'
  | 'article_devto'
  | 'article_hashnode'
  | 'article_blogger'
  | 'article_tumblr'
  | 'pinterest_captions'
  | 'telegram_posts'
  | 'email_sequence'
  | 'lead_magnet'
  | 'faq_block'
  | 'headlines'
  | 'cta_variants'

export const ALL_CONTENT_TYPES: ContentType[] = [
  'bridge_page',
  'article_devto',
  'article_hashnode',
  'article_blogger',
  'article_tumblr',
  'pinterest_captions',
  'telegram_posts',
  'email_sequence',
  'lead_magnet',
  'faq_block',
  'headlines',
  'cta_variants',
]

export async function generateAllContent(
  brief: ContentBrief,
  offer: OfferContext,
  onProgress?: (type: ContentType, index: number, total: number) => void
): Promise<GeneratedContent[]> {
  const results: GeneratedContent[] = []
  const types = ALL_CONTENT_TYPES

  for (let i = 0; i < types.length; i++) {
    const type = types[i]
    onProgress?.(type, i + 1, types.length)
    console.log(`[content-generator] Generating ${type} (${i + 1}/${types.length})`)

    try {
      let text = ''
      let html: string | undefined

      switch (type) {
        case 'bridge_page': {
          const h = await generateBridgePage(brief, offer)
          text = h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          html = h
          break
        }
        case 'article_devto':
          text = await generateArticle(brief, offer, 'dev.to')
          break
        case 'article_hashnode':
          text = await generateArticle(brief, offer, 'hashnode')
          break
        case 'article_blogger':
          text = await generateArticle(brief, offer, 'blogger')
          break
        case 'article_tumblr':
          text = await generateArticle(brief, offer, 'tumblr')
          break
        case 'pinterest_captions':
          text = await generatePinterestCaptions(brief, offer)
          break
        case 'telegram_posts':
          text = await generateTelegramPosts(brief, offer)
          break
        case 'email_sequence':
          text = await generateEmailSequence(brief, offer)
          break
        case 'lead_magnet': {
          const h = await generateLeadMagnet(brief, offer)
          text = h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          html = h
          break
        }
        case 'faq_block':
          text = await generateFAQBlock(brief, offer)
          break
        case 'headlines':
          text = await generateHeadlines(brief, offer)
          break
        case 'cta_variants':
          text = await generateCTAVariants(brief, offer)
          break
      }

      results.push({ type, text, html })
    } catch (err) {
      console.error(`[content-generator] Failed to generate ${type}:`, err)
      results.push({ type, text: `[Generation failed for ${type}]` })
    }
  }

  return results
}
