import { Queue, Worker, Job } from 'bullmq'
import IORedis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379'

// Parse Redis URL for ioredis
function redisConnection() {
  const url = new URL(REDIS_URL)
  return new IORedis({
    host: url.hostname,
    port: parseInt(url.port || '6379'),
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  })
}

export const QUEUE_NAMES = {
  OFFER_PIPELINE: 'offer-pipeline',
  CONTENT_GEN: 'content-gen',
  PUBLISH: 'publish',
  EMAIL_DRIP: 'email-drip',
  TELEGRAM: 'telegram',
} as const

/**
 * Get a BullMQ Queue instance (for producers — API routes, server actions)
 */
export function getQueue(name: string): Queue {
  return new Queue(name, { connection: redisConnection() })
}

/**
 * Get the offer pipeline queue (singleton for API layer)
 */
let _offerQueue: Queue | null = null
export function getOfferQueue(): Queue {
  if (!_offerQueue) {
    _offerQueue = getQueue(QUEUE_NAMES.OFFER_PIPELINE)
  }
  return _offerQueue
}

export type OfferPipelineJobData = {
  offerId: string
  campaignId: string
  hoplink: string
}
