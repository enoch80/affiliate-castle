import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getOfferQueue } from '@/lib/queue'
import { z } from 'zod'

const schema = z.object({
  hoplink: z.string().url('Must be a valid URL').max(2048),
})

export async function POST(req: NextRequest) {
  // Auth guard
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Validate input
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 })
  }

  const { hoplink } = parsed.data

  // Create Offer record
  const offer = await prisma.offer.create({
    data: { hoplink, status: 'pending' },
  })

  // Create Campaign record
  const campaign = await prisma.campaign.create({
    data: {
      offerId: offer.id,
      name: hoplink,
      status: 'draft',
    },
  })

  // Enqueue the full pipeline job
  const queue = getOfferQueue()
  await queue.add('process', {
    offerId: offer.id,
    campaignId: campaign.id,
    hoplink,
  })

  return NextResponse.json({
    campaignId: campaign.id,
    offerId: offer.id,
    hoplink,
    status: 'queued',
    message: 'Campaign created. Pipeline is running.',
  }, { status: 201 })
}
