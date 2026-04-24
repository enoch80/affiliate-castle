/**
 * GET /api/campaigns/[id]/bridge
 *
 * Returns bridge page variants for a campaign.
 * Requires authentication (401 if not authenticated).
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: { id: string }
}

export async function GET(request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      bridgePages: {
        orderBy: { createdAt: 'asc' },
      },
      leadMagnets: {
        select: { id: true, title: true, type: true, pdfPath: true, downloadCount: true, createdAt: true },
      },
    },
  })

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  const pages = campaign.bridgePages.map(p => {
    const content = p.contentJson as Record<string, string> | null
    return {
      id: p.id,
      slug: p.slug,
      templateId: p.templateId,
      abVariant: content?.abVariant || null,
      headline: content?.headline || null,
      niche: content?.niche || null,
      views: p.views,
      optIns: p.optIns,
      conversionRate: p.views > 0 ? ((p.optIns / p.views) * 100).toFixed(1) : null,
      publishedAt: p.publishedAt,
      publicUrl: `/go/${p.slug}`,
      createdAt: p.createdAt,
    }
  })

  return NextResponse.json({
    campaignId: campaign.id,
    campaignStatus: campaign.status,
    totalVariants: pages.length,
    variantA: pages.find(p => p.abVariant === 'A') || pages[0] || null,
    variantB: pages.find(p => p.abVariant === 'B') || pages[1] || null,
    pages,
    leadMagnets: campaign.leadMagnets,
  })
}
