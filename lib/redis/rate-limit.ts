import { getRedis } from "@/lib/redis/client"
import { redisRateLimitKey } from "@/lib/redis/keys"

export type RateLimitOk = { ok: true; remaining: number; retryAfterSec: number }
export type RateLimitLimited = { ok: false; remaining: 0; retryAfterSec: number }
export type RateLimitResult = RateLimitOk | RateLimitLimited

export const MOBILE_RATE_LIMITS = {
  search: { limit: 60, windowMs: 60_000 },
  signUp: { limit: 8, windowMs: 10 * 60_000 },
  message: { limit: 30, windowMs: 60_000 },
} as const

const MEMORY_MAX_BUCKETS = 5_000

type MemoryBucket = { count: number; resetAt: number }

const memoryBuckets = new Map<string, MemoryBucket>()

/** INCR + PEXPIRE in one round trip so a crash cannot leave a key without TTL. */
const FIXED_WINDOW_SCRIPT = `
local n = redis.call("INCR", KEYS[1])
if n == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return {n, ttl}
`

function pruneMemoryBuckets(now: number): void {
  if (memoryBuckets.size < MEMORY_MAX_BUCKETS) return
  for (const [key, bucket] of memoryBuckets) {
    if (bucket.resetAt <= now) memoryBuckets.delete(key)
  }
  if (memoryBuckets.size <= MEMORY_MAX_BUCKETS) return
  const overflow = memoryBuckets.size - Math.floor(MEMORY_MAX_BUCKETS * 0.8)
  let dropped = 0
  for (const key of memoryBuckets.keys()) {
    memoryBuckets.delete(key)
    dropped += 1
    if (dropped >= overflow) break
  }
}

function consumeMemoryFixedWindow(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  pruneMemoryBuckets(now)
  const existing = memoryBuckets.get(key)
  if (!existing || existing.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: Math.max(0, limit - 1), retryAfterSec: Math.max(1, Math.ceil(windowMs / 1000)) }
  }
  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }
  existing.count += 1
  return {
    ok: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  }
}

function logRedisRateLimitError(key: string, error: unknown): void {
  console.error("[redis] rate limit failed", {
    key,
    timestamp: new Date().toISOString(),
    message: error instanceof Error ? error.message : String(error),
  })
}

async function consumeRedisFixedWindow(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const result = await redis.eval(FIXED_WINDOW_SCRIPT, [key], [String(windowMs)])
    if (!Array.isArray(result) || result.length < 2) return null
    const count = Number(result[0])
    const ttlMs = Number(result[1])
    if (!Number.isFinite(count) || count < 1) return null
    const retryAfterSec = Math.max(1, Math.ceil(Math.max(ttlMs, 1) / 1000))
    if (count > limit) {
      return { ok: false, remaining: 0, retryAfterSec }
    }
    return { ok: true, remaining: Math.max(0, limit - count), retryAfterSec }
  } catch (error) {
    logRedisRateLimitError(key, error)
    return null
  }
}

export function rateLimitClientIp(request: { headers: Headers }): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp
  return "unknown"
}

/**
 * Cluster-safe fixed window when Redis is configured; per-instance memory otherwise.
 * Redis errors fall back to memory so an outage does not fail open across all instances.
 */
export async function consumeRateLimit(params: {
  scope: string
  id: string
  limit: number
  windowMs: number
}): Promise<RateLimitResult> {
  const key = redisRateLimitKey(params.scope, params.id)
  const redisResult = await consumeRedisFixedWindow(key, params.limit, params.windowMs)
  if (redisResult) return redisResult
  return consumeMemoryFixedWindow(key, params.limit, params.windowMs)
}

export async function consumeMobileSearchRateLimit(request: { headers: Headers }): Promise<RateLimitResult> {
  return consumeRateLimit({
    scope: "mobile:search",
    id: rateLimitClientIp(request),
    limit: MOBILE_RATE_LIMITS.search.limit,
    windowMs: MOBILE_RATE_LIMITS.search.windowMs,
  })
}

export async function consumeMobileSignUpRateLimit(request: { headers: Headers }): Promise<RateLimitResult> {
  return consumeRateLimit({
    scope: "mobile:signup",
    id: rateLimitClientIp(request),
    limit: MOBILE_RATE_LIMITS.signUp.limit,
    windowMs: MOBILE_RATE_LIMITS.signUp.windowMs,
  })
}

export async function consumeMobileMessageRateLimit(userId: string): Promise<RateLimitResult> {
  return consumeRateLimit({
    scope: "mobile:messages",
    id: userId,
    limit: MOBILE_RATE_LIMITS.message.limit,
    windowMs: MOBILE_RATE_LIMITS.message.windowMs,
  })
}

/** Test-only: drop in-process buckets so cases do not leak. */
export function resetMemoryRateLimits(): void {
  memoryBuckets.clear()
}
