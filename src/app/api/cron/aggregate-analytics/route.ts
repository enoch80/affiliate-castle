/**
 * POST /api/cron/aggregate-analytics
 *
 * Aggregates ClickEvent + Conversion data into DailyAnalytic (upsert).
 * Also updates Campaign totalClicks / totalConversions / totalRevenue.
 *
 * Protected by CRON_SECRET header.
 * Intended to be called daily by a server cron:
 *   curl -X POST http://localhost:3200/api/cron/aggregate-analytics \
 *        -H "x-cron-secret: $CRON_SECRET"
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = request.headers.get('x-cron-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Aggregate clicks by campaignId + day from ClickEvent
  const clickRows = await prisma.$queryRaw<
    { campaignId: string; date: Date; clicks: bigint; uniqueClicks: bigint }[]
  >`
    SELECT tl."campaignId", DATE_TRUNC('day', ce."clickedAt") AS date,
           COUNT(*) AS clicks, COUNT(DISTINCT ce."ipHash") AS "uniqueClicks"
    FROM "ClickEvent" ce
    JOIN "TrackingLink" tl ON tl.id = ce."trackingLinkId"
    GROUP BY tl."campaignId", DATE_TRUNC('day', ce."clickedAt")
  `

  // 2. Aggregate conversions by campaignId + day
  const convRows = await prisma.$queryRaw<
    { campaignId: string; date: Date; conversions: bigint; revenue: number }[]
  >`
    SELECT "campaignId", DATE_TRUNC('day', "convertedAt") AS date,
           COUNT(*) AS conversions, SUM(revenue) AS revenue
    FROM "Conversion"
    GROUP BY "campaignId", DATE_TRUNC('day', "convertedAt")
  `

  // 3. Merge into a map keyed by "campaignId|date"
  type RowData = {
    campaignId: string; date: Date; clicks: number; uniqueClicks: number;
    conversions: number; revenue: number
  }
  const map = new Map<string, RowData>()

  for (const r of clickRows) {
    const key = `${r.campaignId}|${r.date.toISOString()}`
    map.set(key, {
      campaignId: r.campaignId,
      date: r.date,
      clicks: Number(r.clicks),
      uniqueClicks: Number(r.uniqueClicks),
      conversions: 0,
      revenue: 0,
    })
  }

  for (const r of convRows) {
    const key = `${r.campaignId}|${r.date.toISOString()}`
    const existing = map.get(key)
    if (existing) {
      existing.conversions = Number(r.conversions)
      existing.revenue = Number(r.revenue)
    } else {
      map.set(key, {
        campaignId: r.campaignId,
        date: r.date,
        clicks: 0,
        uniqueClicks: 0,
        conversions: Number(r.conversions),
        revenue: Number(r.revenue),
      })
    }
  }

  // 4. Upsert each DailyAnalytic row
  let upserted = 0
  for (const row of Array.from(map.values())) {
    await prisma.dailyAnalytic.upsert({
      where: { campaignId_date: { campaignId: row.campaignId, date: row.date } },
      create: {
        id: `${row.campaignId}_${row.date.toISOString().split('T')[0]}`,
        campaignId: row.campaignId,
        date: row.date,
        clicks: row.clicks,
        uniqueClicks: row.uniqueClicks,
        conversions: row.conversions,
        revenue: row.revenue,
      },
      update: {
        clicks: row.clicks,
        uniqueClicks: row.uniqueClicks,
        conversions: row.conversions,
        revenue: row.revenue,
      },
    })
    upserted++
  }

  // 5. Update Campaign totals
  const allIds = clickRows.map((r) => r.campaignId).concat(convRows.map((r) => r.campaignId))
  const campaignIds = allIds.filter((v, i, a) => a.indexOf(v) === i)
  for (const campaignId of campaignIds) {
    const clickSum = clickRows
      .filter((r) => r.campaignId === campaignId)
      .reduce((a, r) => a + Number(r.clicks), 0)
    const conv = convRows.filter((r) => r.campaignId === campaignId)
    const convSum = conv.reduce((a, r) => a + Number(r.conversions), 0)
    const revSum = conv.reduce((a, r) => a + Number(r.revenue), 0)

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { totalClicks: clickSum, totalConversions: convSum, totalRevenue: revSum },
    })
  }

  return NextResponse.json({ ok: true, upserted, campaigns: campaignIds.length })
}
