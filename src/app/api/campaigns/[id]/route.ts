import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    include: {
      offer: {
        include: {
          marketResearch: true,
          keywordResearch: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
      contentPieces: { orderBy: { createdAt: 'desc' } },
      publishJobs: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  return NextResponse.json(campaign)
}
