import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Find the content_brief piece for this campaign
  const briefPiece = await prisma.contentPiece.findFirst({
    where: { campaignId: params.id, type: 'content_brief' },
    orderBy: { createdAt: 'desc' },
  })

  if (!briefPiece) {
    return NextResponse.json({ error: 'Brief not yet generated' }, { status: 404 })
  }

  return NextResponse.json({
    id: briefPiece.id,
    status: briefPiece.status,
    brief: briefPiece.serpBriefJson,
    createdAt: briefPiece.createdAt,
  })
}
