/**
 * Sprint 11 — In-process rate limiter (token bucket per IP / per route).
 *
 * Not suitable for multi-instance deploys, but Affiliate Castle runs on a single
 * Contabo VPS, so one Node.js process — this is sufficient.
 *
 * Buckets are stored in a Map and automatically purged after TTL to prevent
 * unbounded memory growth.
 *
 * Usage:
 *   const ok = rateLimit('click', ip, { requests: 60, windowSec: 60 })
 *   if (!ok) return 429
 */

const store = new Map<string, { count: number; resetAt: number }>()

const PURGE_INTERVAL_MS = 5 * 60 * 1000 // purge stale entries every 5 min

setInterval(() => {
  const now = Date.now()
  Array.from(store.entries()).forEach(([key, bucket]) => {
    if (bucket.resetAt < now) store.delete(key)
  })
}, PURGE_INTERVAL_MS).unref()

/**
 * Check and record a rate-limit hit.
 *
 * @param namespace  Logical bucket namespace (e.g. 'click', 'optin', 'api')
 * @param identifier Client identifier — should already be IP-hashed (SHA-256)
 * @param options    requests: max requests allowed; windowSec: rolling window
 * @returns true if request is allowed, false if rate limit exceeded
 */
export function rateLimit(
  namespace: string,
  identifier: string,
  options: { requests: number; windowSec: number }
): boolean {
  const key = `${namespace}:${identifier}`
  const now = Date.now()
  const windowMs = options.windowSec * 1000

  const bucket = store.get(key)

  if (!bucket || bucket.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (bucket.count >= options.requests) {
    return false
  }

  bucket.count += 1
  return true
}
