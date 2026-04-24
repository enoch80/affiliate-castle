/**
 * GET /api/campaigns/[id]/analytics
 *
 * Returns per-campaign analytics:
 * - summary: totalClicks, totalConversions, totalRevenue, epc, conversionRate
 * - 30-day daily series (clicks, conversions, revenue, optIns)
 * - conversion funnel: impressions → clicks → bridgeViews → optIns → emailClicks → conversions
 * - platform EPC breakdown from tracking links
 *
 * Auth: requires valid session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: campaignId } = params

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      name: true,
      status: true,
      totalClicks: true,
      totalConversions: true,
      totalRevenue: true,
    },
  })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  // 30-day daily series for this campaign
  const since = new Date()
  since.setDate(since.getDate() - 29)
  since.setHours(0, 0, 0, 0)

  const daily = await prisma.dailyAnalytic.findMany({
    where: { campaignId, date: { gte: since } },
    orderBy: { date: 'asc' },
    select: {
      date: true,
      clicks: true,
      uniqueClicks: true,
      conversions: true,
      revenue: true,
      optIns: true,
      emailOpens: true,
      emailClicks: true,
      telegramViews: true,
    },
  })

  // Build full 30-day series (fill gaps with 0)
  const series: {
    date: string
    clicks: number
    uniqueClicks: number
    conversions: number
    revenue: number
    optIns: number
    emailOpens: number
    emailClicks: number
    telegramViews: number
  }[] = []

  for (let i = 0; i < 30; i++) {
    const d = new Date(since)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    const row = daily.find((r) => r.date.toISOString().split('T')[0] === dateStr)
    series.push({
      date: dateStr,
      clicks: row?.clicks ?? 0,
      uniqueClicks: row?.uniqueClicks ?? 0,
      conversions: row?.conversions ?? 0,
      revenue: row?.revenue ?? 0,
      optIns: row?.optIns ?? 0,
      emailOpens: row?.emailOpens ?? 0,
      emailClicks: row?.emailClicks ?? 0,
      telegramViews: row?.telegramViews ?? 0,
    })
  }

  // Conversion funnel — building from real DB sources
  const [clickEventCount, conversionCount, optInCount, emailStepTotals, telegramTotal] =
    await Promise.all([
      prisma.clickEvent.count({ where: { trackingLink: { campaignId } } }),
      prisma.conversion.count({ where: { campaignId } }),
      // optIns = sum across daily analytics (best proxy)
      prisma.dailyAnalytic.aggregate({
        where: { campaignId },
        _sum: { optIns: true, emailClicks: true, telegramViews: true },
      }),
      prisma.emailSequenceStep.aggregate({
        where: { sequence: { campaignId } },
        _sum: { sentCount: true, openCount: true, clickCount: true },
      }),
      prisma.dailyAnalytic.aggregate({
        where: { campaignId },
        _sum: { telegramViews: true },
      }),
    ])

  const totalOptIns = optInCount._sum.optIns ?? 0
  const totalEmailClicks = emailStepTotals._sum.clickCount ?? 0
  // Impressions = telegram views + content page visits (use telegramViews as proxy)
  const impressions = telegramTotal._sum.telegramViews ?? 0

  const funnel = [
    { stage: 'Impressions', value: impressions, description: 'Telegram views + content reach' },
    { stage: 'Clicks', value: clickEventCount, description: 'Tracked link clicks' },
    { stage: 'Bridge Views', value: clickEventCount, description: 'Bridge page visits (via tracked links)' },
    { stage: 'Opt-ins', value: totalOptIns, description: 'Email list sign-ups' },
    { stage: 'Email Clicks', value: totalEmailClicks, description: 'Clicks from email sequence' },
    { stage: 'Conversions', value: conversionCount, description: 'Affiliate sales / postback confirmations' },
  ]

  // Platform EPC breakdown — aggregate conversions and revenue per tracking link
  const trackingLinks = await prisma.trackingLink.findMany({
    where: { campaignId },
    select: {
      platformSource: true,
      clicks: true,
      conversions: { select: { revenue: true } },
    },
  })

  const platformBreakdown = trackingLinks.map((tl) => {
    const convCount = tl.conversions.length
    const rev = tl.conversions.reduce((sum, c) => sum + c.revenue, 0)
    return {
      platform: tl.platformSource ?? 'direct',
      clicks: tl.clicks,
      conversions: convCount,
      revenue: rev,
      epc: tl.clicks > 0 ? Math.round((rev / tl.clicks) * 100) / 100 : 0,
      conversionRate: tl.clicks > 0 ? Math.round((convCount / tl.clicks) * 10000) / 100 : 0,
    }
  })

  const epc =
    campaign.totalClicks > 0
      ? Math.round((campaign.totalRevenue / campaign.totalClicks) * 100) / 100
      : 0
  const conversionRate =
    campaign.totalClicks > 0
      ? Math.round((campaign.totalConversions / campaign.totalClicks) * 10000) / 100
      : 0

  return NextResponse.json({
    campaignId,
    campaignName: campaign.name,
    campaignStatus: campaign.status,
    summary: {
      totalClicks: campaign.totalClicks,
      totalConversions: campaign.totalConversions,
      totalRevenue: campaign.totalRevenue,
      epc,
      conversionRate,
    },
    series,
    funnel,
    platformBreakdown,
  })
}
