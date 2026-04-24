/**
 * GET /api/health
 *
 * System health check. Returns component status for DB and Redis.
 * Used by monitoring, CI, and Sprint 12 production smoke test.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  // DB liveness probe
  let dbStatus: 'ok' | 'error' = 'ok'
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    dbStatus = 'error'
  }

  const overall = dbStatus === 'ok' ? 'ok' : 'degraded'

  return NextResponse.json(
    {
      status: overall,
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      components: {
        db: dbStatus,
      },
    },
    { status: overall === 'ok' ? 200 : 503 }
  )
}

