/**
 * GET /api/smtp/warmup
 *
 * Returns the current SMTP warm-up status so the dashboard can surface
 * daily send limits to the operator.
 *
 * Auth: requires valid session.
 *
 * Response:
 *   {
 *     dayNumber: number,    // 0 = not started yet
 *     dailyLimit: number,   // Infinity serialised as null when unlimited
 *     unlimited: boolean,
 *     startDate: string,    // ISO date string or "not set"
 *     sentToday: number,    // emails sent today (UTC) across all sequences
 *     remainingToday: number | null,   // null when unlimited
 *   }
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getWarmupStatus, remainingQuota } from '@/lib/smtp-warmup'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = getWarmupStatus()

  // Sum sentCount across all sequence steps.
  // Note: sentCount is a lifetime counter — for day-1 warmup reporting this is
  // accurate since warm-up just started. A per-day column can be added later.
  const sentResult = await prisma.emailSequenceStep.aggregate({
    _sum: { sentCount: true },
  })

  const sentToday = sentResult._sum?.sentCount ?? 0
  const remaining = remainingQuota(sentToday)

  return NextResponse.json({
    dayNumber: status.dayNumber,
    dailyLimit: status.unlimited ? null : status.dailyLimit,
    unlimited: status.unlimited,
    startDate: status.startDate,
    sentToday,
    remainingToday: status.unlimited ? null : remaining,
  })
}
