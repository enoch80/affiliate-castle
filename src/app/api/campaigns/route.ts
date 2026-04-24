/**
 * GET /api/campaigns
 *
 * Returns the authenticated user's campaign list as a JSON array.
 * Auth: requires valid session (401 if not).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: { offer: true },
  })

  return NextResponse.json(campaigns)
}
