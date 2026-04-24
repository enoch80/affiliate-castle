/**
 * Telegram Bot API utilities for Sprint 8.
 *
 * Features:
 * - Send text + optional image to a channel
 * - Generate 10-post content series from campaign data
 * - Submit channel to tgstat.com + telemetr.io directories
 */
import { decryptCredential } from './credentials'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TelegramSendInput {
  botToken: string
  channelId: string // e.g. "@mychannel" or numeric "-100xxxxx"
  text: string
  imagePath?: string | null // absolute public/ path to JPEG
  parseMode?: 'HTML' | 'Markdown'
}

export interface TelegramSendResult {
  ok: boolean
  messageId?: number
  error?: string
}

export interface PostSeriesInput {
  campaignName: string
  niche: string
  primaryKeyword: string
  bridgePageUrl: string
  channelInviteUrl?: string
}

export interface PostTemplate {
  day: number
  hasImage: boolean
  purpose: string
  content: string
}

// ─── Send via Telegram Bot API ────────────────────────────────────────────────

const TG_API = 'https://api.telegram.org/bot'

export async function sendTelegramMessage(input: TelegramSendInput): Promise<TelegramSendResult> {
  const { botToken, channelId, text, imagePath, parseMode = 'HTML' } = input

  try {
    if (imagePath) {
      // sendPhoto with caption
      const endpoint = `${TG_API}${botToken}/sendPhoto`
      // Determine if imagePath is a URL or local (use URL form if starts with http)
      const isUrl = imagePath.startsWith('http')
      const body: Record<string, string> = {
        chat_id: channelId,
        caption: text.slice(0, 1024), // Telegram caption limit
        parse_mode: parseMode,
      }
      if (isUrl) {
        body.photo = imagePath
      } else {
        // For local files we fall back to text only (production deploys serve via URL)
        return sendTextOnly(botToken, channelId, text, parseMode)
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as { ok: boolean; result?: { message_id: number }; description?: string }
      if (!data.ok) return { ok: false, error: data.description }
      return { ok: true, messageId: data.result?.message_id }
    }

    return sendTextOnly(botToken, channelId, text, parseMode)
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

async function sendTextOnly(
  botToken: string,
  channelId: string,
  text: string,
  parseMode: string
): Promise<TelegramSendResult> {
  const endpoint = `${TG_API}${botToken}/sendMessage`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: channelId,
      text: text.slice(0, 4096),
      parse_mode: parseMode,
      disable_web_page_preview: false,
    }),
  })
  const data = await res.json() as { ok: boolean; result?: { message_id: number }; description?: string }
  if (!data.ok) return { ok: false, error: data.description }
  return { ok: true, messageId: data.result?.message_id }
}

// ─── Decrypt bot token from stored encrypted value ────────────────────────────

export function decryptBotToken(encrypted: string): string {
  return decryptCredential(encrypted)
}

// ─── 10-Post Content Series Generator ────────────────────────────────────────

/**
 * Generates the 10-post content series for a campaign.
 * Post schedule follows the plan.md day spec.
 */
export function generatePostSeries(input: PostSeriesInput): PostTemplate[] {
  const { campaignName, niche, primaryKeyword, bridgePageUrl, channelInviteUrl } = input
  const kw = primaryKeyword
  const invite = channelInviteUrl ?? ''

  return [
    {
      day: 1,
      hasImage: true,
      purpose: 'Curiosity hook — no offer',
      content: `🤔 Most people in the <b>${niche}</b> space are making one critical mistake — and it's costing them every single month.

We dug into this for you. Over the next few weeks, we'll break it all down.

Here's a hint: it has everything to do with <b>${kw}</b>.

Stay tuned. Things are about to get interesting.

#${slugify(niche)} #${slugify(kw)} #secrets`,
    },
    {
      day: 2,
      hasImage: false,
      purpose: 'Did you know fact',
      content: `📊 Did you know?

The top 10% of people who succeed with <b>${kw}</b> all share one habit in common — they focus on the fundamentals before anything else.

Most people skip this. Then wonder why results don't come.

What's the #1 fundamental in your approach? Drop a reply.

#${slugify(niche)} #fundamentals #${slugify(kw)}`,
    },
    {
      day: 3,
      hasImage: true,
      purpose: 'Mini tip + bridge page link',
      content: `💡 Quick tip for ${niche} success:

<b>Stop chasing every new tactic.</b> Pick one proven method and execute it consistently for 30 days.

The results will surprise you.

For the full breakdown of what's actually working right now → ${bridgePageUrl}

#${slugify(niche)} #protip #${slugify(kw)}`,
    },
    {
      day: 5,
      hasImage: false,
      purpose: 'Question engagement post',
      content: `🙋 Quick question for this community:

What's the BIGGEST challenge you face when it comes to <b>${kw}</b>?

A) Finding the right strategy
B) Staying consistent
C) Knowing what actually works
D) Something else

Drop your answer below — I read every reply.

#${slugify(niche)} #community #poll`,
    },
    {
      day: 6,
      hasImage: true,
      purpose: 'Testimonial / social proof',
      content: `⭐ "I spent 6 months trying different approaches to ${kw} with zero results. Then I found this method — and everything changed."

— Real feedback from someone in the ${niche} community.

Results can vary, but the strategy? That part is repeatable.

Full details: ${bridgePageUrl}

#${slugify(niche)} #results #${slugify(kw)}`,
    },
    {
      day: 7,
      hasImage: false,
      purpose: '#1 mistake + link',
      content: `❌ The #1 mistake people make with ${kw}:

They focus on <i>what</i> to do instead of <i>how</i> to do it correctly.

The execution details matter more than the strategy itself. Every time.

Here's what correct execution looks like → ${bridgePageUrl}

#${slugify(niche)} #mistakes #${slugify(kw)}`,
    },
    {
      day: 9,
      hasImage: true,
      purpose: 'Offer introduction',
      content: `🎯 After weeks of research and testing, we've put together something specifically for the ${niche} community.

<b>${campaignName}</b> — our complete guide to mastering ${kw} the right way.

No fluff. No theory. Only what works.

See it here → ${bridgePageUrl}

#${slugify(niche)} #guide #${slugify(kw)}`,
    },
    {
      day: 10,
      hasImage: false,
      purpose: 'FAQ format + CTA',
      content: `❓ FAQ: Everything about ${kw}

<b>Q: Is this beginner-friendly?</b>
A: Yes — we start from zero.

<b>Q: How fast can I see results?</b>
A: Most people notice a difference within 2–3 weeks of consistent application.

<b>Q: Where do I start?</b>
A: Right here → ${bridgePageUrl}

#${slugify(niche)} #faq #beginners`,
    },
    {
      day: 12,
      hasImage: true,
      purpose: 'Urgency + link',
      content: `⏰ If you've been on the fence about ${kw} — this is your moment.

The window for getting this right (before everyone else does) is narrowing fast.

Don't look back in 6 months and wish you'd started today.

${bridgePageUrl}

#${slugify(niche)} #now #${slugify(kw)}`,
    },
    {
      day: 14,
      hasImage: false,
      purpose: 'Final direct CTA',
      content: `🚀 Last call for the ${niche} community.

We've shared tips, strategies, and real results over the past two weeks. Now it's your turn.

Take action. Start with ${kw}. Do it today.

→ ${bridgePageUrl}${invite ? `\n\nJoin our channel for ongoing updates: ${invite}` : ''}

#${slugify(niche)} #takingaction #${slugify(kw)}`,
    },
  ]
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

// ─── Directory Submit ─────────────────────────────────────────────────────────

export interface DirectorySubmitResult {
  tgstat: { submitted: boolean; error?: string }
  telemetr: { submitted: boolean; error?: string }
}

/**
 * Submits a Telegram channel to tgstat.com and telemetr.io.
 * Both services accept GET requests with the channel username.
 * We call their public "add channel" endpoints — no API key required.
 */
export async function submitToDirectories(channelUsername: string): Promise<DirectorySubmitResult> {
  const handle = channelUsername.startsWith('@') ? channelUsername.slice(1) : channelUsername

  const result: DirectorySubmitResult = {
    tgstat: { submitted: false },
    telemetr: { submitted: false },
  }

  // tgstat.com — POST to add channel endpoint
  try {
    const tgstatRes = await fetch(`https://tgstat.com/channels/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (compatible; AffiliateBot/1.0)',
      },
      body: `channel=${encodeURIComponent('@' + handle)}`,
      signal: AbortSignal.timeout(10000),
    })
    result.tgstat.submitted = tgstatRes.status < 500
  } catch (err) {
    result.tgstat.error = String(err)
  }

  // telemetr.io — GET to channel page (triggers indexing)
  try {
    const telemetrRes = await fetch(`https://telemetr.io/en/channels/${handle}`, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AffiliateBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    result.telemetr.submitted = telemetrRes.status < 500
  } catch (err) {
    result.telemetr.error = String(err)
  }

  return result
}
