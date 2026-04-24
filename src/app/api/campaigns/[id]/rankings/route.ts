/**
 * GET  /api/campaigns/[id]/rankings  — latest rank snapshots + 30-day history
 * POST /api/campaigns/[id]/rankings  — trigger a live Bing rank check right now
 *
 * Auth: requires valid session (401 if not authenticated).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { checkCampaignRankings, getCampaignRankHistory } from '@/lib/rank-tracker'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: campaignId } = params

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  })
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  const { latest, history } = await getCampaignRankHistory(campaignId)

  const bestRank =
    latest.filter((r) => r.rank !== null).length > 0
      ? Math.min(...latest.filter((r) => r.rank !== null).map((r) => r.rank as number))
      : null

  return NextResponse.json({
    campaignId,
    bestRank,
    top10Count: latest.filter((r) => r.inTop10).length,
    top50Count: latest.filter((r) => r.inTop50).length,
    latest,
    history,
  })
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: campaignId } = params

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  })
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  try {
    const report = await checkCampaignRankings(campaignId)
    return NextResponse.json(report, { status: 200 })
  } catch (err) {
    console.error('[rankings] rank check failed:', err)
    return NextResponse.json(
      { error: 'Rank check failed', detail: (err as Error).message },
      { status: 500 }
    )
  }
}
