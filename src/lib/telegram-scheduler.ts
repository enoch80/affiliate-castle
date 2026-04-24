/**
 * Telegram scheduling logic for Sprint 8.
 *
 * Queues the 10-post series into BullMQ TELEGRAM queue with day-based delays.
 * Optimal post times (UTC): 8:00 AM, 12:00 PM, 9:00 PM (rotated by post index).
 */
import { getQueue, QUEUE_NAMES } from './queue'
import { generatePostSeries, PostSeriesInput } from './telegram'
import { prisma } from './prisma'

// Optimal UTC hours in rotation order (per plan.md)
const POST_HOURS = [8, 12, 21]

export interface ScheduleInput extends PostSeriesInput {
  campaignId: string
  channelId: string // TelegramChannel.id (cuid)
  channelTgId: string // "@username" or numeric id used by Bot API
  coverImageUrl?: string | null
}

export interface ScheduleResult {
  postsQueued: number
  postIds: string[]
}

/**
 * Creates TelegramPost records in the DB and enqueues each post
 * in BullMQ with a delay matching its scheduled day + optimal hour.
 */
export async function scheduleTelegramSeries(input: ScheduleInput): Promise<ScheduleResult> {
  const {
    campaignId,
    channelId,
    channelTgId,
    coverImageUrl,
    ...seriesInput
  } = input

  const series = generatePostSeries(seriesInput)
  const now = new Date()
  const queue = getQueue(QUEUE_NAMES.TELEGRAM)

  const postIds: string[] = []

  for (let i = 0; i < series.length; i++) {
    const template = series[i]
    const hour = POST_HOURS[i % POST_HOURS.length]

    // Compute scheduledAt: start of day 0 in UTC = now, then add template.day days
    const scheduledAt = new Date(now)
    scheduledAt.setUTCDate(scheduledAt.getUTCDate() + template.day)
    scheduledAt.setUTCHours(hour, 0, 0, 0)

    // Persist the queued post record
    const post = await prisma.telegramPost.create({
      data: {
        campaignId,
        channelId,
        content: template.content,
        imagePath: template.hasImage ? (coverImageUrl ?? null) : null,
        status: 'queued',
        scheduledAt,
      },
      select: { id: true },
    })

    postIds.push(post.id)

    // Delay in ms from now until scheduledAt
    const delayMs = Math.max(0, scheduledAt.getTime() - Date.now())

    await queue.add(
      'send-post',
      {
        telegramPostId: post.id,
        campaignId,
        channelTgId,
        content: template.content,
        imagePath: template.hasImage ? (coverImageUrl ?? null) : null,
      },
      {
        delay: delayMs,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60000 },
        jobId: `telegram-post-${post.id}`,
        removeOnComplete: { count: 100 },
        removeOnFail: false,
      }
    )
  }

  return { postsQueued: series.length, postIds }
}
