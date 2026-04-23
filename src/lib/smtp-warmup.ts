/**
 * SMTP Warm-up Controller
 *
 * Enforces a ramping daily email send limit to avoid spam filter triggers.
 * Schedule: auto-enforced from SMTP_WARMUP_START_DATE in .env
 *
 * Warm-up ramp (industry standard):
 * Day 1–7:    50/day
 * Day 8–14:  100/day
 * Day 15–21: 300/day
 * Day 22–28: 600/day
 * Day 29–35: 1000/day
 * Day 36+:   unlimited (your Listmonk config governs)
 */

export interface WarmupStatus {
  dayNumber: number
  dailyLimit: number
  unlimited: boolean
  startDate: string
}

const RAMP: Array<{ upToDay: number; limit: number }> = [
  { upToDay: 7, limit: 50 },
  { upToDay: 14, limit: 100 },
  { upToDay: 21, limit: 300 },
  { upToDay: 28, limit: 600 },
  { upToDay: 35, limit: 1000 },
]

export function getWarmupStatus(): WarmupStatus {
  const startDateStr = process.env.SMTP_WARMUP_START_DATE

  if (!startDateStr) {
    // Not configured — treat as unlimited (new installs without SMTP warm-up)
    return { dayNumber: 0, dailyLimit: Infinity, unlimited: true, startDate: 'not set' }
  }

  const startDate = new Date(startDateStr)
  const now = new Date()
  const msPerDay = 1000 * 60 * 60 * 24
  const dayNumber = Math.floor((now.getTime() - startDate.getTime()) / msPerDay) + 1

  if (dayNumber < 1) {
    // Warm-up hasn't started yet
    return { dayNumber: 0, dailyLimit: 0, unlimited: false, startDate: startDateStr }
  }

  for (const tier of RAMP) {
    if (dayNumber <= tier.upToDay) {
      return { dayNumber, dailyLimit: tier.limit, unlimited: false, startDate: startDateStr }
    }
  }

  // Past ramp — unlimited
  return { dayNumber, dailyLimit: Infinity, unlimited: true, startDate: startDateStr }
}

/**
 * Returns true if we are allowed to send `count` more emails today.
 * Pass the already-sent count for today from your DB/cache.
 */
export function canSendEmails(alreadySentToday: number, count = 1): boolean {
  const status = getWarmupStatus()
  if (status.unlimited) return true
  if (status.dailyLimit === 0) return false
  return alreadySentToday + count <= status.dailyLimit
}

/**
 * Returns how many more emails can be sent today.
 */
export function remainingQuota(alreadySentToday: number): number {
  const status = getWarmupStatus()
  if (status.unlimited) return Infinity
  if (status.dailyLimit === 0) return 0
  return Math.max(0, status.dailyLimit - alreadySentToday)
}
