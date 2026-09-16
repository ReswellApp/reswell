type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number }

const buckets = new Map<string, number[]>()

/** Best-effort in-process sliding window. Enough to blunt abuse on a single instance. */
export function consumeLiveChatRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now()
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
