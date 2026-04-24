/**
 * GET  /api/channels        — list all active TelegramChannels
 * POST /api/channels        — register a new TelegramChannel
 *
 * POST body:
 *   { botToken: string, channelUsername: string, displayName: string }
 *
 * botToken is stored AES-256-GCM encrypted. The channel is immediately
 * submitted to tgstat.com + telemetr.io directories (non-fatal).
 *
 * Requires auth.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encryptCredential } from '@/lib/credentials'
import { submitToDirectories } from '@/lib/telegram'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const registerSchema = z.object({
  botToken: z.string().min(20),
  channelUsername: z.string().min(2),
  displayName: z.string().min(1).max(120),
})

// ─── GET /api/channels ────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const channels = await prisma.telegramChannel.findMany({
    where: { isActive: true },
    select: {
      id: true,
      channelUsername: true,
      channelId: true,
      displayName: true,
      subscriberCount: true,
      lastSyncedAt: true,
      createdAt: true,
      _count: { select: { posts: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ channels })
}

// ─── POST /api/channels ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.issues }, { status: 400 })
  }

  const { botToken, channelUsername, displayName } = parsed.data

  // Normalise username
  const username = channelUsername.startsWith('@') ? channelUsername : `@${channelUsername}`

  // Encrypt the bot token before storing
  const botTokenEncrypted = encryptCredential(botToken)

  const channel = await prisma.telegramChannel.create({
    data: {
      botTokenEncrypted,
      channelUsername: username,
      displayName,
    },
    select: {
      id: true,
      channelUsername: true,
      displayName: true,
      createdAt: true,
    },
  })

  // Submit to directories (non-fatal)
  let directoryResult = null
  try {
    directoryResult = await submitToDirectories(username)
  } catch (err) {
    console.warn('[channels] Directory submit failed (non-fatal):', err)
  }

  return NextResponse.json({
    channel,
    directorySubmit: directoryResult,
  }, { status: 201 })
}
