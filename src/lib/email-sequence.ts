/**
 * Email drip sequence content generator for Sprint 9.
 *
 * Generates:
 * - 7-email main sequence (Days 0, 1, 3, 5, 7, 10, 14)
 * - 3-email re-engagement sequence (Days 17, 20, 23 — for subscribers with 0 opens)
 *
 * Emotional arc follows plan.md:
 *   Email 1 (Day 0):  RELIEF      — deliver promised lead magnet
 *   Email 2 (Day 1):  TRUST       — personal story, no sell
 *   Email 3 (Day 3):  RESPECT     — pure value, Telegram invite
 *   Email 4 (Day 5):  CURIOSITY   — introduce mechanism, first CTA
 *   Email 5 (Day 7):  PROOF       — testimonial stories
 *   Email 6 (Day 10): SAFETY      — objection handling, guarantee
 *   Email 7 (Day 14): URGENCY     — final call, value stack
 */

export interface EmailTemplateInput {
  campaignName: string
  niche: string
  primaryKeyword: string
  bridgePageUrl: string
  leadMagnetUrl?: string | null
  telegramInviteUrl?: string | null
  senderName?: string
  senderEmail?: string
  physicalAddress?: string
  unsubscribeUrl?: string
}

export interface EmailTemplate {
  stepNumber: number
  delayDays: number
  subject: string
  previewText: string
  bodyHtml: string
  isReEngage: boolean
}

const DEFAULT_SENDER = 'Your Guide'
const DEFAULT_ADDRESS = '123 Main St, Anytown, USA'
const DEFAULT_UNSUB = '{{unsubscribe_url}}'

// ─── HTML wrapper ─────────────────────────────────────────────────────────────

function emailWrapper(
  bodyContent: string,
  opts: {
    senderName: string
    physicalAddress: string
    unsubscribeUrl: string
  }
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Email</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:6px;overflow:hidden;">
      <tr><td style="padding:32px 40px;color:#374151;font-size:16px;line-height:1.7;">
        ${bodyContent}
      </td></tr>
      <tr><td style="padding:20px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:13px;color:#9ca3af;text-align:center;">
        <p style="margin:0 0 8px;">You received this because you opted in to hear from ${opts.senderName}.</p>
        <p style="margin:0 0 8px;">${opts.physicalAddress}</p>
        <p style="margin:0;"><a href="${opts.unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

function ctaButton(text: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr><td align="center" style="background:#f97316;border-radius:4px;">
    <a href="${url}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-weight:bold;font-size:16px;text-decoration:none;font-family:Arial,sans-serif;">${text}</a>
  </td></tr>
</table>`
}

function p(text: string): string {
  return `<p style="margin:0 0 24px;">${text}</p>\n`
}

// ─── Main 7-email sequence ────────────────────────────────────────────────────

export function generateEmailSequence(input: EmailTemplateInput): EmailTemplate[] {
  const {
    campaignName,
    niche,
    primaryKeyword: kw,
    bridgePageUrl,
    leadMagnetUrl,
    telegramInviteUrl,
    senderName = DEFAULT_SENDER,
    physicalAddress = DEFAULT_ADDRESS,
    unsubscribeUrl = DEFAULT_UNSUB,
  } = input

  const wrapOpts = { senderName, physicalAddress, unsubscribeUrl }
  const lead = leadMagnetUrl ?? bridgePageUrl
  const tg = telegramInviteUrl ?? ''

  const templates: Array<Omit<EmailTemplate, 'bodyHtml'> & { rawBody: string }> = [
    // Email 1 — Day 0 — RELIEF
    {
      stepNumber: 1,
      delayDays: 0,
      subject: `Here's everything I promised you about ${kw}`,
      previewText: `Your resource is inside — plus a quick note from me`,
      isReEngage: false,
      rawBody: `
        ${p(`Hi {{subscriber.first_name}},`)}
        ${p(`Welcome — and thank you for trusting me with your inbox.`)}
        ${p(`I promised you something valuable about <strong>${kw}</strong>. Here it is:`)}
        ${ctaButton('Access Your Resource Now', lead)}
        ${p(`Take 10 minutes today to go through it. The single insight on page 3 alone is worth your time.`)}
        ${p(`Tomorrow I'll share something personal — a story I've never told publicly about how I started in ${niche}.`)}
        ${p(`Talk soon,<br>${senderName}`)}
      `,
    },

    // Email 2 — Day 1 — TRUST
    {
      stepNumber: 2,
      delayDays: 1,
      subject: `The mistake that cost me 18 months`,
      previewText: `I've never told anyone this before`,
      isReEngage: false,
      rawBody: `
        ${p(`Hi {{subscriber.first_name}},`)}
        ${p(`Before I got any of this right, I spent 18 months doing ${niche} completely wrong.`)}
        ${p(`I followed every guru, bought every course, and still got nowhere.`)}
        ${p(`The turning point? I stopped looking for shortcuts and started focusing on <strong>one specific thing about ${kw}</strong> that nobody was talking about.`)}
        ${p(`I'm not selling you anything today. I just want you to know — if you're feeling frustrated right now, that feeling is completely normal. And it ends.`)}
        ${p(`Tomorrow I'll share a tactic that completely changed my approach to ${niche}. It takes about 15 minutes to implement.`)}
        ${p(`Talk soon,<br>${senderName}`)}
      `,
    },

    // Email 3 — Day 3 — RESPECT
    {
      stepNumber: 3,
      delayDays: 3,
      subject: `The 3 things top ${niche} people never tell you`,
      previewText: `Pure value — no pitch, I promise`,
      isReEngage: false,
      rawBody: `
        ${p(`Hi {{subscriber.first_name}},`)}
        ${p(`No pitch today. Just three things I've learned about ${kw} that have made the biggest difference:`)}
        ${p(`<strong>1. Speed matters less than consistency.</strong> The people winning in ${niche} aren't faster — they just stop stopping.`)}
        ${p(`<strong>2. The right information beats more information.</strong> One reliable source beats ten conflicting ones.`)}
        ${p(`<strong>3. Feedback loops accelerate everything.</strong> Build in checkpoints or you won't know you're off-course until it's expensive to fix.`)}
        ${p(`Implement just one of these this week.`)}
        ${tg ? `${p(`P.S. I share insights like this daily in my Telegram channel. <a href="${tg}" style="color:#f97316;">Join here — it's free.</a>`)}` : ''}
        ${p(`Talk soon,<br>${senderName}`)}
      `,
    },

    // Email 4 — Day 5 — CURIOSITY
    {
      stepNumber: 4,
      delayDays: 5,
      subject: `Why most ${niche} advice fails (and the one thing that works)`,
      previewText: `I call it the "${kw} mechanism" — here's what it is`,
      isReEngage: false,
      rawBody: `
        ${p(`Hi {{subscriber.first_name}},`)}
        ${p(`Here's why most ${niche} advice fails: it focuses on tactics without addressing the underlying mechanism.`)}
        ${p(`Think of it like trying to lose weight by only counting calories — while ignoring sleep and stress. Tactics without mechanism = temporary results.`)}
        ${p(`The "${kw} mechanism" I use works because it targets the root cause, not the symptom.`)}
        ${p(`I've put together a full breakdown:`)}
        ${ctaButton('See the Full Breakdown', bridgePageUrl)}
        ${p(`This is the closest thing to a shortcut I know — but it only works if you implement it properly. The page explains exactly how.`)}
        ${p(`Talk soon,<br>${senderName}`)}
      `,
    },

    // Email 5 — Day 7 — PROOF
    {
      stepNumber: 5,
      delayDays: 7,
      subject: `Real results: what happened when people tried this`,
      previewText: `Three stories from people in the ${niche} community`,
      isReEngage: false,
      rawBody: `
        ${p(`Hi {{subscriber.first_name}},`)}
        ${p(`I want to share three results from people who've used the approach I described:`)}
        ${p(`<em>"I'd tried everything for ${kw} and nothing worked until I found this. Within 3 weeks I saw a real change."</em> — member of the ${niche} community`)}
        ${p(`<em>"Simple, clear, and actually works. I was skeptical but the results speak for themselves."</em> — another reader`)}
        ${p(`<em>"Finally an approach that treats me like an adult and gives me real information."</em> — recent opt-in`)}
        ${p(`Results vary of course — but the pattern is consistent: people who implement this specific approach see better results than those who don't.`)}
        ${p(`If you haven't tried it yet, here's the resource again:`)}
        ${ctaButton('Get Started Today', bridgePageUrl)}
        ${p(`Talk soon,<br>${senderName}`)}
      `,
    },

    // Email 6 — Day 10 — SAFETY
    {
      stepNumber: 6,
      delayDays: 10,
      subject: `Your biggest question about ${kw} — answered`,
      previewText: `I've heard this objection hundreds of times`,
      isReEngage: false,
      rawBody: `
        ${p(`Hi {{subscriber.first_name}},`)}
        ${p(`The biggest question I get about ${kw} is always some version of: <strong>"What if it doesn't work for me?"</strong>`)}
        ${p(`Fair question. Here's my honest answer:`)}
        ${p(`This approach doesn't work for everyone the same way, the same speed, or with the same results. But it has never failed to produce <em>some</em> measurable improvement for anyone who actually implements it as described.`)}
        ${p(`The risk? You spend 20-30 minutes applying it and see no difference. That's the worst case.`)}
        ${p(`The realistic case? You get exactly what you came here for.`)}
        ${ctaButton("I'm Ready — Show Me", bridgePageUrl)}
        ${p(`Talk soon,<br>${senderName}`)}
      `,
    },

    // Email 7 — Day 14 — URGENCY
    {
      stepNumber: 7,
      delayDays: 14,
      subject: `This is my last email about ${kw} (for now)`,
      previewText: `I\'m moving on \u2014 but wanted to give you one last thing first`,
      isReEngage: false,
      rawBody: `
        ${p(`Hi {{subscriber.first_name}},`)}
        ${p(`I've spent the last two weeks sharing everything I know about ${kw}.`)}
        ${p(`Today is my last email on this specific topic. After this, I'll be covering new ground in ${niche}.`)}
        ${p(`Before I go, here's everything you need in one place:`)}
        ${p(`✔ The core resource: <a href="${lead}" style="color:#f97316;">${lead}</a><br>✔ The mechanism that makes it work: <a href="${bridgePageUrl}" style="color:#f97316;">${bridgePageUrl}</a>${tg ? `<br>✔ Daily insights: <a href="${tg}" style="color:#f97316;">Join the Telegram channel</a>` : ''}`)}
        ${p(`The people who act on information like this are the ones who get ahead. The others just collect emails.`)}
        ${p(`Which one are you?`)}
        ${ctaButton('Take Action Now', bridgePageUrl)}
        ${p(`P.S. If you don't click anything from this whole sequence, at least do this one thing: forward it to one person who needs it. That one act could change their trajectory.`)}
        ${p(`Talk soon,<br>${senderName}`)}
      `,
    },
  ]

  return templates.map(({ rawBody, ...rest }) => ({
    ...rest,
    bodyHtml: emailWrapper(rawBody, wrapOpts),
  }))
}

// ─── Re-engagement sequence (Days 17, 20, 23) ────────────────────────────────

export function generateReEngageSequence(input: EmailTemplateInput): EmailTemplate[] {
  const {
    bridgePageUrl,
    niche,
    senderName = DEFAULT_SENDER,
    physicalAddress = DEFAULT_ADDRESS,
    unsubscribeUrl = DEFAULT_UNSUB,
  } = input

  const wrapOpts = { senderName, physicalAddress, unsubscribeUrl }

  const templates: Array<Omit<EmailTemplate, 'bodyHtml'> & { rawBody: string }> = [
    {
      stepNumber: 8,
      delayDays: 17,
      subject: `Did I do something wrong, {{subscriber.first_name}}?`,
      previewText: `Genuinely asking — your silence has me wondering`,
      isReEngage: true,
      rawBody: `
        ${p(`Hi {{subscriber.first_name}},`)}
        ${p(`I've sent a few emails and noticed you haven't opened any of them.`)}
        ${p(`I'm not going to pretend that's normal — I genuinely want to know if I missed the mark.`)}
        ${p(`Was it the topic? The format? Too many emails? Too few?`)}
        ${p(`Reply to this email and just tell me. I read every reply.`)}
        ${p(`If the ${niche} content is no longer relevant, I completely understand. You can remove yourself here: <a href="${unsubscribeUrl}" style="color:#6b7280;">unsubscribe</a>`)}
        ${p(`Talk soon,<br>${senderName}`)}
      `,
    },

    {
      stepNumber: 9,
      delayDays: 20,
      subject: `One thing before I give up on us...`,
      previewText: `I've been holding this back — thought I'd share it now`,
      isReEngage: true,
      rawBody: `
        ${p(`Hi {{subscriber.first_name}},`)}
        ${p(`I almost didn't send this.`)}
        ${p(`But before I stop reaching out, I wanted to share the single most valuable thing I know about ${niche}.`)}
        ${p(`It's the insight I wish someone had given me at the beginning — the one that would have saved me years.`)}
        ${ctaButton('Read It Here', bridgePageUrl)}
        ${p(`If this doesn't resonate with you, I completely understand. No hard feelings.`)}
        ${p(`Talk soon,<br>${senderName}`)}
      `,
    },

    {
      stepNumber: 10,
      delayDays: 23,
      subject: `I'm removing you from my list this Friday`,
      previewText: `Loss aversion activated — please read`,
      isReEngage: true,
      rawBody: `
        ${p(`Hi {{subscriber.first_name}},`)}
        ${p(`I've tried reaching out a couple of times without hearing back.`)}
        ${p(`I'm going to remove you from my list this Friday — not as a punishment, just to keep my list healthy and to respect your inbox.`)}
        ${p(`If you want to stay and keep receiving ${niche} updates, just click below before Friday:`)}
        ${ctaButton('Yes, Keep Me On The List', bridgePageUrl)}
        ${p(`If not, no action needed. I'll take care of it.`)}
        ${p(`Either way — thank you for being here. I genuinely hope the content helped you in some way.`)}
        ${p(`Warmly,<br>${senderName}`)}
      `,
    },
  ]

  return templates.map(({ rawBody, ...rest }) => ({
    ...rest,
    bodyHtml: emailWrapper(rawBody, wrapOpts),
  }))
}

// ─── Combined sequence (7 main + 3 re-engage = 10 steps) ─────────────────────

export function generateFullSequence(input: EmailTemplateInput): EmailTemplate[] {
  return [
    ...generateEmailSequence(input),
    ...generateReEngageSequence(input),
  ]
}
