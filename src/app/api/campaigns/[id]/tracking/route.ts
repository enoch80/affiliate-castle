/**
 * GET /api/campaigns/[id]/tracking
 *
 * Returns click and conversion analytics for a campaign, broken down
 * by platform source. Requires auth.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      totalClicks: true,
      totalConversions: true,
      trackingLinks: {
        select: {
          id: true,
          shortCode: true,
          platformSource: true,
          destinationUrl: true,
          clicks: true,
          uniqueClicks: true,
          createdAt: true,
          conversions: {
            select: {
              id: true,
              revenue: true,
              networkTransactionId: true,
              convertedAt: true,
            },
            orderBy: { convertedAt: 'desc' },
            take: 50,
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  const links = campaign.trackingLinks.map((link) => {
    const totalRevenue = link.conversions.reduce((sum, c) => sum + c.revenue, 0)
    const epc = link.uniqueClicks > 0 ? totalRevenue / link.uniqueClicks : 0

    return {
      id: link.id,
      shortCode: link.shortCode,
      platformSource: link.platformSource,
      clicks: link.clicks,
      uniqueClicks: link.uniqueClicks,
      conversions: link.conversions.length,
      revenue: Math.round(totalRevenue * 100) / 100,
      epc: Math.round(epc * 100) / 100,
      conversionRate:
        link.uniqueClicks > 0
          ? Math.round((link.conversions.length / link.uniqueClicks) * 10000) / 100
          : 0,
      publicRedirectUrl: `${req.nextUrl.origin}/api/r/${link.shortCode}`,
      recentConversions: link.conversions.slice(0, 5).map((c) => ({
        id: c.id,
        revenue: c.revenue,
        convertedAt: c.convertedAt,
      })),
    }
  })

  const totalRevenue = links.reduce((sum, l) => sum + l.revenue, 0)
  const totalUniqueClicks = links.reduce((sum, l) => sum + l.uniqueClicks, 0)

  return NextResponse.json({
    campaignId: campaign.id,
    status: campaign.status,
    summary: {
      totalClicks: campaign.totalClicks,
      totalUniqueClicks,
      totalConversions: campaign.totalConversions,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      overallEpc:
        totalUniqueClicks > 0
          ? Math.round((totalRevenue / totalUniqueClicks) * 100) / 100
          : 0,
    },
    links,
  })
}
