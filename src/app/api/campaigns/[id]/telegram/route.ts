/**
 * GET  /api/campaigns/[id]/telegram — post schedule + stats
 * POST /api/campaigns/[id]/telegram — trigger 10-post series scheduling
 *
 * POST body:
 *   { channelId: string }   — TelegramChannel.id to post to
 *
 * Requires auth.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { scheduleTelegramSeries } from '@/lib/telegram-scheduler'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// ─── GET /api/campaigns/[id]/telegram ────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      status: true,
      telegramPosts: {
        select: {
          id: true,
          channelId: true,
          status: true,
          scheduledAt: true,
          sentAt: true,
          views: true,
          forwards: true,
          imagePath: true,
        },
        orderBy: { scheduledAt: 'asc' },
      },
    },
  })

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  const total = campaign.telegramPosts.length
  const sent = campaign.telegramPosts.filter((p) => p.status === 'sent').length
  const queued = campaign.telegramPosts.filter((p) => p.status === 'queued').length
  const failed = campaign.telegramPosts.filter((p) => p.status === 'failed').length

  return NextResponse.json({
    campaignId: campaign.id,
    campaignStatus: campaign.status,
    totalPosts: total,
    sent,
    queued,
    failed,
    posts: campaign.telegramPosts,
  })
}

// ─── POST /api/campaigns/[id]/telegram ───────────────────────────────────────

const scheduleSchema = z.object({
  channelId: z.string().cuid(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = scheduleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.issues }, { status: 400 })
  }

  const { channelId } = parsed.data

  // Load campaign + channel
  const [campaign, channel] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        offerId: true,
        offer: {
          select: {
            keywordResearch: {
              select: { primaryKeyword: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
        bridgePages: {
          select: { slug: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    }),
    prisma.telegramChannel.findUnique({
      where: { id: channelId },
      select: { id: true, channelUsername: true, channelId: true },
    }),
  ])

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }
  if (!channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
  }

  const baseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3200'
  const bridgeSlug = campaign.bridgePages[0]?.slug
  const bridgePageUrl = bridgeSlug ? `${baseUrl}/go/${bridgeSlug}` : baseUrl

  const keyword = campaign.offer.keywordResearch[0]?.primaryKeyword ?? campaign.name
  // Infer niche from keyword (simple: use first word capitalised)
  const niche = keyword.split(' ')[0]

  const result = await scheduleTelegramSeries({
    campaignId: campaign.id,
    channelId: channel.id,
    channelTgId: channel.channelId ?? channel.channelUsername,
    campaignName: campaign.name,
    niche,
    primaryKeyword: keyword,
    bridgePageUrl,
  })

  // Advance campaign status to 'live' once Telegram series is queued
  await prisma.campaign.update({
    where: { id: params.id },
    data: { status: 'live' },
  })

  return NextResponse.json({
    success: true,
    postsQueued: result.postsQueued,
    postIds: result.postIds,
    campaignStatus: 'live',
  }, { status: 201 })
}
