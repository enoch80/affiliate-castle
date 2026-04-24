/**
 * GET /api/analytics
 *
 * Returns aggregate dashboard metrics across all campaigns:
 * - totalClicks, totalConversions, totalRevenue, totalOptIns
 * - 30-day daily time-series (clicks, conversions, revenue, optIns)
 * - campaignCount + activeCampaignCount
 * - EPC (earnings per click)
 *
 * Auth: requires valid session (401 if not).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Aggregate totals across all campaigns
  const totals = await prisma.campaign.aggregate({
    _sum: {
      totalClicks: true,
      totalConversions: true,
      totalRevenue: true,
    },
    _count: { id: true },
  })

  const activeCampaignCount = await prisma.campaign.count({
    where: { status: { in: ['live', 'publishing', 'indexed', 'bridge_ready', 'content_ready'] } },
  })

  // 30-day daily analytics — aggregate across all campaigns
  const since = new Date()
  since.setDate(since.getDate() - 29)
  since.setHours(0, 0, 0, 0)

  const daily = await prisma.dailyAnalytic.groupBy({
    by: ['date'],
    where: { date: { gte: since } },
    _sum: {
      clicks: true,
      uniqueClicks: true,
      conversions: true,
      revenue: true,
      optIns: true,
      emailOpens: true,
      emailClicks: true,
      telegramViews: true,
    },
    orderBy: { date: 'asc' },
  })

  // Build full 30-day series (fill missing days with 0)
  const series: {
    date: string
    clicks: number
    conversions: number
    revenue: number
    optIns: number
  }[] = []

  for (let i = 0; i < 30; i++) {
    const d = new Date(since)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    const row = daily.find(
      (r) => r.date.toISOString().split('T')[0] === dateStr
    )
    series.push({
      date: dateStr,
      clicks: row?._sum.clicks ?? 0,
      conversions: row?._sum.conversions ?? 0,
      revenue: row?._sum.revenue ?? 0,
      optIns: row?._sum.optIns ?? 0,
    })
  }

  const totalClicks = totals._sum.totalClicks ?? 0
  const totalRevenue = totals._sum.totalRevenue ?? 0
  const epc = totalClicks > 0 ? totalRevenue / totalClicks : 0

  return NextResponse.json({
    totalClicks,
    totalConversions: totals._sum.totalConversions ?? 0,
    totalRevenue,
    totalOptIns: series.reduce((a, b) => a + b.optIns, 0),
    epc: Math.round(epc * 100) / 100,
    campaignCount: totals._count.id,
    activeCampaignCount,
    series,
  })
}
