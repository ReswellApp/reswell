import { consumeRateLimit, rateLimitClientIp } from "@/lib/redis/rate-limit"

type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number }

export const LIVE_CHAT_RATE_LIMITS = {
  sessionCreate: { limit: 20, windowMs: 10 * 60_000 },
  message: { limit: 30, windowMs: 60_000 },
  typing: { limit: 40, windowMs: 60_000 },
  ai: { limit: 8, windowMs: 60_000 },
  aiIp: { limit: 16, windowMs: 10 * 60_000 },
  actionsGet: { limit: 60, windowMs: 60_000 },
  actionsPost: { limit: 10, windowMs: 60_000 },
} as const

export async function consumeLiveChatRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const consumed = await consumeRateLimit({
    scope: "live-chat",
    id: key,
    limit,
    windowMs,
  })
  if (!consumed.ok) return { ok: false, retryAfterSec: consumed.retryAfterSec }
  return { ok: true }
}

export function liveChatClientIp(req: { headers: Headers }): string {
  return rateLimitClientIp(req)
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
