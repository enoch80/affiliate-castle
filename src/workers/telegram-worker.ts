/**
 * Telegram BullMQ Worker — Sprint 8
 *
 * Processes 'send-post' jobs from the TELEGRAM queue.
 * Each job sends one post (text or photo) to the channel via Bot API.
 * On success: updates TelegramPost.status = 'sent', sentAt = now
 * On failure: updates TelegramPost.status = 'failed'
 */
import { Worker, Job } from 'bullmq'
import IORedis from 'ioredis'
import { prisma } from '../lib/prisma'
import { sendTelegramMessage, decryptBotToken } from '../lib/telegram'
import { QUEUE_NAMES } from '../lib/queue'

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379'

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

interface TelegramJobData {
  telegramPostId: string
  campaignId: string
  channelTgId: string
  content: string
  imagePath: string | null
}

async function processTelegramJob(job: Job<TelegramJobData>): Promise<void> {
  const { telegramPostId, channelTgId, content, imagePath } = job.data

  // Load the TelegramPost → Channel → bot token
  const post = await prisma.telegramPost.findUnique({
    where: { id: telegramPostId },
    include: {
      channel: { select: { botTokenEncrypted: true, channelId: true } },
    },
  })

  if (!post) {
    console.warn(`[telegram-worker] Post ${telegramPostId} not found — skipping`)
    return
  }

  if (post.status === 'sent') {
    console.info(`[telegram-worker] Post ${telegramPostId} already sent — skipping`)
    return
  }

  const botToken = decryptBotToken(post.channel.botTokenEncrypted)
  const targetId = post.channel.channelId ?? channelTgId

  const result = await sendTelegramMessage({
    botToken,
    channelId: targetId,
    text: content,
    imagePath,
    parseMode: 'HTML',
  })

  if (result.ok) {
    await prisma.telegramPost.update({
      where: { id: telegramPostId },
      data: {
        status: 'sent',
        sentAt: new Date(),
      },
    })
    console.log(`[telegram-worker] ✅ Sent post ${telegramPostId} to ${targetId} (msgId ${result.messageId})`)
  } else {
    await prisma.telegramPost.update({
      where: { id: telegramPostId },
      data: { status: 'failed' },
    })
    throw new Error(`Telegram send failed: ${result.error}`)
  }
}

const worker = new Worker<TelegramJobData>(
  QUEUE_NAMES.TELEGRAM,
  processTelegramJob,
  {
    connection,
    concurrency: 3,
  }
)

worker.on('completed', (job) => {
  console.log(`[telegram-worker] ✅ Job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  console.error(`[telegram-worker] ❌ Job ${job?.id} failed:`, err.message)
})

worker.on('error', (err) => {
  console.error('[telegram-worker] Worker error:', err)
})

console.log('[telegram-worker] Worker started, listening on queue:', QUEUE_NAMES.TELEGRAM)

export default worker
