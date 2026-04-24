/**
 * GET /api/campaigns/[id]/publishing
 *
 * Returns publishing status for all platforms for a campaign.
 * Requires auth.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
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
      publishJobs: {
        select: {
          id: true,
          platform: true,
          status: true,
          platformUrl: true,
          errorMessage: true,
          attemptCount: true,
          publishedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  const platforms = ['devto', 'hashnode', 'blogger', 'tumblr']
  const jobs = campaign.publishJobs

  const platformStatus = platforms.map((platform) => {
    const job = jobs.find((j) => j.platform === platform)
    return {
      platform,
      status: job?.status ?? 'not_started',
      platformUrl: job?.platformUrl ?? null,
      errorMessage: job?.errorMessage ?? null,
      attemptCount: job?.attemptCount ?? 0,
      publishedAt: job?.publishedAt ?? null,
    }
  })

  const publishedCount = platformStatus.filter((p) => p.status === 'published').length
  const allPublished = publishedCount === platforms.length
  const anyPublished = publishedCount > 0

  return NextResponse.json({
    campaignId: campaign.id,
    campaignStatus: campaign.status,
    publishedCount,
    allPublished,
    anyPublished,
    platforms: platformStatus,
    liveUrls: platformStatus.filter((p) => p.platformUrl).map((p) => p.platformUrl!),
  })
}
