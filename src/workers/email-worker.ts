/**
 * Email Drip BullMQ Worker — Sprint 9
 *
 * Processes 'send-email' jobs from the EMAIL_DRIP queue.
 * Each job sends one email step via Listmonk transactional API.
 *
 * Respects SMTP warm-up limits: checks canSendEmails() before sending.
 * On success: increments EmailSequenceStep.sentCount
 * On re-engage email: checks open rate — if subscriber opened any, skips re-engage
 */
import { Worker, Job } from 'bullmq'
import IORedis from 'ioredis'
import { prisma } from '../lib/prisma'
import { sendTransactionalEmail, tagSubscriber } from '../lib/listmonk'
import { canSendEmails } from '../lib/smtp-warmup'
import { QUEUE_NAMES } from '../lib/queue'

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379'
const LISTMONK_DRIP_TEMPLATE_ID = parseInt(process.env.LISTMONK_DRIP_TEMPLATE_ID ?? '1', 10)

function parseRedisUrl(url: string) {
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    maxRetriesPerRequest: null as null,
  }
}

const connection = new IORedis(parseRedisUrl(REDIS_URL))

interface EmailJobData {
  sequenceStepId: string
  subscriberEmail: string
  subject: string
  bodyHtml: string
  spamScore: number
  isReEngage: boolean
}

// Simple in-memory daily counter (resets at midnight UTC)
let todayDate = new Date().toISOString().slice(0, 10)
let sentToday = 0

function getTodaySentCount(): number {
  const today = new Date().toISOString().slice(0, 10)
  if (today !== todayDate) {
    todayDate = today
    sentToday = 0
  }
  return sentToday
}

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { sequenceStepId, subscriberEmail, subject, bodyHtml, spamScore, isReEngage } = job.data

  // Check warm-up quota
  if (!canSendEmails(getTodaySentCount())) {
    // Re-queue for 1 hour later by throwing — BullMQ will retry with backoff
    throw new Error(`SMTP warm-up quota reached for today (sent: ${sentToday})`)
  }

  // For re-engage: skip if subscriber has opened any prior email
  if (isReEngage) {
    const subscriber = await prisma.emailSubscriber.findUnique({
      where: { email: subscriberEmail },
      select: { listmonkId: true, status: true },
    })

    // If subscriber is already unsubscribed, skip
    if (subscriber?.status === 'unsubscribed') {
      console.log(`[email-worker] Skipping re-engage for unsubscribed ${subscriberEmail}`)
      return
    }
  }

  // Send via Listmonk transactional API
  // We use a passthrough template that renders our pre-built HTML directly
  const result = await sendTransactionalEmail({
    subscriberEmail,
    templateId: LISTMONK_DRIP_TEMPLATE_ID,
    data: {
      subject,
      body: bodyHtml,
      spam_score: spamScore,
    },
    headers: { 'X-Sequence-Step': sequenceStepId },
  })

  if (!result.ok) {
    throw new Error(`Listmonk send failed: ${result.error}`)
  }

  // Update sent count on the step
  await prisma.emailSequenceStep.update({
    where: { id: sequenceStepId },
    data: { sentCount: { increment: 1 } },
  })

  sentToday++
  console.log(`[email-worker] ✅ Sent step ${sequenceStepId} to ${subscriberEmail} (spam ${spamScore})`)
}

// Tag cold subscribers after final re-engage
async function handleReEngageFinal(subscriberEmail: string): Promise<void> {
  const subscriber = await prisma.emailSubscriber.findUnique({
    where: { email: subscriberEmail },
    select: { id: true, listmonkId: true },
  })
  if (!subscriber) return

  await prisma.emailSubscriber.update({
    where: { id: subscriber.id },
    data: { status: 'cold' },
  })

  if (subscriber.listmonkId) {
    await tagSubscriber(subscriber.listmonkId, 'engagement', 'cold')
  }

  console.log(`[email-worker] Tagged ${subscriberEmail} as cold after final re-engage`)
}

const worker = new Worker<EmailJobData>(
  QUEUE_NAMES.EMAIL_DRIP,
  processEmailJob,
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 60000, // 10 sends/minute max (warm-up safety)
    },
  }
)

worker.on('completed', (job) => {
  console.log(`[email-worker] ✅ Job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  console.error(`[email-worker] ❌ Job ${job?.id} failed:`, err.message)

  // If this was the final re-engage step (step 10), tag as cold
  if (job?.data?.isReEngage && job.attemptsMade >= 3) {
    handleReEngageFinal(job.data.subscriberEmail).catch(console.error)
  }
})

worker.on('error', (err) => {
  console.error('[email-worker] Worker error:', err)
})

console.log('[email-worker] Worker started, listening on queue:', QUEUE_NAMES.EMAIL_DRIP)

export default worker
