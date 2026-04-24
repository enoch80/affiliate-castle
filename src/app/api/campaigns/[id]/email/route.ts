/**
 * GET  /api/campaigns/[id]/email — sequence stats + step summary
 * POST /api/campaigns/[id]/email — trigger drip sequence for a subscriber
 *
 * POST body:
 *   { email: string, firstName?: string }
 *
 * Requires auth.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { scheduleDripSequence } from '@/lib/drip-scheduler'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// ─── GET /api/campaigns/[id]/email ───────────────────────────────────────────

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
      emailSequences: {
        select: {
          id: true,
          name: true,
          steps: {
            select: {
              id: true,
              stepNumber: true,
              delayDays: true,
              subject: true,
              previewText: true,
              sentCount: true,
              openCount: true,
              clickCount: true,
            },
            orderBy: { stepNumber: 'asc' },
          },
        },
        orderBy: { id: 'desc' },
        take: 1,
      },
    },
  })

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  const sequence = campaign.emailSequences[0] ?? null
  const steps = sequence?.steps ?? []

  const totalSent = steps.reduce((s, e) => s + e.sentCount, 0)
  const totalOpens = steps.reduce((s, e) => s + e.openCount, 0)
  const totalClicks = steps.reduce((s, e) => s + e.clickCount, 0)

  return NextResponse.json({
    campaignId: campaign.id,
    campaignStatus: campaign.status,
    sequenceId: sequence?.id ?? null,
    totalSteps: steps.length,
    totalSent,
    totalOpens,
    totalClicks,
    openRate: totalSent > 0 ? Math.round((totalOpens / totalSent) * 100) : 0,
    steps,
  })
}

// ─── POST /api/campaigns/[id]/email ──────────────────────────────────────────

const subscribeSchema = z.object({
  email: z.string().email(),
  firstName: z.string().max(80).optional().default(''),
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

  const parsed = subscribeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.issues }, { status: 400 })
  }

  const { email, firstName } = parsed.data

  // Load campaign for sequence input
  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
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
      leadMagnets: {
        select: { pdfPath: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  const baseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3200'
  const bridgeSlug = campaign.bridgePages[0]?.slug
  const bridgePageUrl = bridgeSlug ? `${baseUrl}/go/${bridgeSlug}` : baseUrl

  const keyword = campaign.offer.keywordResearch[0]?.primaryKeyword ?? campaign.name
  const niche = keyword.split(' ')[0]

  const leadMagnetUrl = campaign.leadMagnets[0]?.pdfPath
    ? `${baseUrl}/${campaign.leadMagnets[0].pdfPath}`
    : null

  const result = await scheduleDripSequence({
    campaignId: campaign.id,
    subscriberEmail: email,
    subscriberFirstName: firstName || email.split('@')[0],
    campaignName: campaign.name,
    niche,
    primaryKeyword: keyword,
    bridgePageUrl,
    leadMagnetUrl,
    senderName: process.env.EMAIL_SENDER_NAME ?? 'Your Guide',
    senderEmail: process.env.EMAIL_SENDER_ADDRESS ?? 'hello@example.com',
    physicalAddress: process.env.EMAIL_PHYSICAL_ADDRESS ?? '123 Main St, Anytown, USA',
    unsubscribeUrl: '{{unsubscribe_url}}',
  })

  return NextResponse.json({
    success: true,
    sequenceId: result.sequenceId,
    stepsCreated: result.stepsCreated,
    stepsBlocked: result.stepsBlocked,
    listmonkSubscriberId: result.listmonkSubscriberId,
    warnings: result.warnings,
  }, { status: 201 })
}
