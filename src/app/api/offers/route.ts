import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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

  // Sprint 2 will: resolve hoplink → scrape offer page → extract product details via LLM
  // → create Offer + Campaign records in DB → enqueue full pipeline job

  // For Sprint 1: return a mock campaign ID so the UI redirects correctly
  const mockCampaignId = `draft-${Date.now()}`

  return NextResponse.json({
    campaignId: mockCampaignId,
    hoplink,
    status: 'queued',
    message: 'Campaign created. Pipeline will start in Sprint 2.',
  }, { status: 201 })
}
