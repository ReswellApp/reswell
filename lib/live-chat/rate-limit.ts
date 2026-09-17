/** Best-effort in-process sliding window. Enough to blunt abuse on a single instance. */

type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number }

const buckets = new Map<string, number[]>()
const MAX_BUCKETS = 5_000

function pruneBuckets(now: number): void {
  if (buckets.size < MAX_BUCKETS) return
  for (const [key, stamps] of buckets) {
    const fresh = stamps.filter((ts) => now - ts < 600_000)
    if (fresh.length === 0) buckets.delete(key)
    else buckets.set(key, fresh)
  }
  if (buckets.size <= MAX_BUCKETS) return
  // Drop oldest keys if still oversized (memory guard).
  const overflow = buckets.size - Math.floor(MAX_BUCKETS * 0.8)
  let dropped = 0
  for (const key of buckets.keys()) {
    buckets.delete(key)
    dropped += 1
    if (dropped >= overflow) break
  }
}

export const LIVE_CHAT_RATE_LIMITS = {
  sessionCreate: { limit: 20, windowMs: 10 * 60_000 },
  message: { limit: 30, windowMs: 60_000 },
  typing: { limit: 40, windowMs: 60_000 },
  ai: { limit: 8, windowMs: 60_000 },
  aiIp: { limit: 16, windowMs: 10 * 60_000 },
  actionsGet: { limit: 60, windowMs: 60_000 },
  actionsPost: { limit: 10, windowMs: 60_000 },
} as const

export function consumeLiveChatRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now()
  pruneBuckets(now)
  const cutoff = now - windowMs
  const prior = buckets.get(key)?.filter((ts) => ts > cutoff) ?? []
  if (prior.length >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((prior[0]! + windowMs - now) / 1000))
    return { ok: false, retryAfterSec }
  }
  prior.push(now)
  buckets.set(key, prior)
  return { ok: true }
}

export function liveChatClientIp(req: { headers: Headers }): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown"
}

export function liveChatRateLimitResponse(retryAfterSec: number): Response {
  return Response.json(
    { error: "Too many requests. Try again in a moment." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  )
}
