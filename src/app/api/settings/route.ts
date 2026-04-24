/**
 * GET  /api/settings         — list all PlatformAccount records (credentials NEVER returned)
 * POST /api/settings         — create or update a PlatformAccount with encrypted credentials
 * DELETE /api/settings?id=X  — remove a PlatformAccount
 *
 * Auth: requires valid session.
 * Credentials are stored AES-256-GCM encrypted via src/lib/credentials.ts.
 * Raw credential strings are NEVER returned in GET responses.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { encryptCredential } from '@/lib/credentials'
import { prisma } from '@/lib/prisma'

// ── Validation schema ────────────────────────────────────────────────────────

const SUPPORTED_PLATFORMS = [
  'devto',
  'hashnode',
  'blogger',
  'tumblr',
  'medium',
  'wordpress',
  'ghost',
  'telegram',
  'email',
  'custom',
] as const

const upsertSchema = z.object({
  platform: z.enum(SUPPORTED_PLATFORMS, {
    errorMap: () => ({
      message: `platform must be one of: ${SUPPORTED_PLATFORMS.join(', ')}`,
    }),
  }),
  username: z.string().min(1).max(100),
  /** Plain-text credential (API key / token / password).  Will be encrypted before storage. */
  credentials: z.string().min(1).max(2048),
  isActive: z.boolean().optional().default(true),
})

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accounts = await prisma.platformAccount.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      platform: true,
      username: true,
      isActive: true,
      lastUsedAt: true,
      createdAt: true,
      // credentialsEncrypted intentionally excluded
    },
  })

  return NextResponse.json({ accounts })
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const parsed = upsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const { platform, username, credentials, isActive } = parsed.data
  const credentialsEncrypted = encryptCredential(credentials)

  // Upsert: if a record with this platform+username already exists, update it
  const existing = await prisma.platformAccount.findFirst({
    where: { platform, username },
    select: { id: true },
  })

  if (existing) {
    const updated = await prisma.platformAccount.update({
      where: { id: existing.id },
      data: { credentialsEncrypted, isActive },
      select: { id: true, platform: true, username: true, isActive: true, createdAt: true },
    })
    return NextResponse.json({ ok: true, account: updated })
  }

  const created = await prisma.platformAccount.create({
    data: { platform, username, credentialsEncrypted, isActive },
    select: { id: true, platform: true, username: true, isActive: true, createdAt: true },
  })

  return NextResponse.json({ ok: true, account: created }, { status: 201 })
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  try {
    await prisma.platformAccount.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
