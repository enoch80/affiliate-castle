import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      contentPieces: {
        where: { NOT: { type: 'content_brief' } },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          type: true,
          detectionScore: true,
          status: true,
          createdAt: true,
        },
      },
    },
  })

  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const pieces = campaign.contentPieces
  const totalPieces = pieces.length
  const passingPieces = pieces.filter(
    (p) => p.detectionScore !== null && (p.detectionScore as number) < 15
  ).length

  return NextResponse.json({
    campaignId: campaign.id,
    campaignStatus: campaign.status,
    totalPieces,
    passingPieces,
    allPass: totalPieces > 0 && passingPieces === totalPieces,
    pieces,
  })
}
