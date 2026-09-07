import { NextResponse } from "next/server"
import { createClient, createUserJwtSupabaseClient } from "@/lib/supabase/server"

export const PUBLIC_API_FREE_LIMIT_PER_MINUTE = 10
export const PUBLIC_API_REGISTERED_LIMIT_PER_MINUTE = 30

export type PublicApiTier = "free" | "registered"

export type PublicApiGuardOk = {
  ok: true
  tier: PublicApiTier
  limitPerMinute: number
  remaining: number
}

export type PublicApiGuardLimited = {
  ok: false
  status: 429
  body: {
    error: string
    message: string
    tier: PublicApiTier
    limit_per_minute: number
    retry_after: number
    upgrade?: {
      limit_per_minute: number
      how: string
      docs: string
    }
  }
  retryAfter: number
}

const WINDOW_MS = 60_000
const DOCS_PATH = "/public-api"

type RateBucket = { count: number; resetAt: number }

const rateBuckets = new Map<string, RateBucket>()

export function publicApiCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
  }
}

export function publicApiOptionsResponse(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: publicApiCorsHeaders(),
  })
}

export function publicApiJson(
  body: unknown,
  status: number,
  extraHeaders?: Record<string, string>,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      ...publicApiCorsHeaders(),
      "Cache-Control": extraHeaders?.["Cache-Control"] ?? "private, no-store",
      ...extraHeaders,
    },
  })
}

function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp
  return "unknown"
}

function pruneBuckets(now: number): void {
  if (rateBuckets.size < 400) return
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) rateBuckets.delete(key)
  }
}

function consumeRateLimit(key: string, limit: number): { allowed: boolean; remaining: number; retryAfter: number } {
  const now = Date.now()
  pruneBuckets(now)
  const existing = rateBuckets.get(key)
  if (!existing || existing.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfter: 60 }
  }
  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }
  existing.count += 1
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  }
}

function docsUrlFromRequest(request: Request): string {
  try {
    return new URL(DOCS_PATH, request.url).toString()
  } catch {
    return DOCS_PATH
  }
}

async function resolveRegisteredUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization")
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim()
    if (token) {
      try {
        const jwtClient = createUserJwtSupabaseClient(token)
        const { data } = await jwtClient.auth.getUser()
        if (data.user?.id) return data.user.id
      } catch (error) {
        console.error("[public-api] bearer auth failed", {
          route: new URL(request.url).pathname,
          timestamp: new Date().toISOString(),
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return data.user?.id ?? null
  } catch {
    return null
  }
}

export async function enforcePublicApiGuard(request: Request): Promise<PublicApiGuardOk | PublicApiGuardLimited> {
  const userId = await resolveRegisteredUserId(request)
  const tier: PublicApiTier = userId ? "registered" : "free"
  const limitPerMinute =
    tier === "registered" ? PUBLIC_API_REGISTERED_LIMIT_PER_MINUTE : PUBLIC_API_FREE_LIMIT_PER_MINUTE
  const bucketKey = userId ? `user:${userId}` : `ip:${clientIpFromRequest(request)}`
  const consumed = consumeRateLimit(bucketKey, limitPerMinute)

  if (!consumed.allowed) {
    const docs = docsUrlFromRequest(request)
    const limited: PublicApiGuardLimited = {
      ok: false,
      status: 429,
      retryAfter: consumed.retryAfter,
      body: {
        error: "Too many requests",
        message:
          tier === "free"
            ? `Free public API limit is ${PUBLIC_API_FREE_LIMIT_PER_MINUTE} requests per minute. Create a free Reswell account and send Authorization: Bearer <auth_token> for ${PUBLIC_API_REGISTERED_LIMIT_PER_MINUTE} requests per minute. Docs: ${docs}`
            : `Registered public API limit is ${PUBLIC_API_REGISTERED_LIMIT_PER_MINUTE} requests per minute. Retry after ${consumed.retryAfter}s. Docs: ${docs}`,
        tier,
        limit_per_minute: limitPerMinute,
        retry_after: consumed.retryAfter,
        ...(tier === "free"
          ? {
              upgrade: {
                limit_per_minute: PUBLIC_API_REGISTERED_LIMIT_PER_MINUTE,
                how: "Send Authorization: Bearer <auth_token> from a registered Reswell account",
                docs,
              },
            }
          : {}),
      },
    }
    return limited
  }

  return {
    ok: true,
    tier,
    limitPerMinute,
    remaining: consumed.remaining,
  }
}

export function publicApiRateLimitHeaders(guard: PublicApiGuardOk): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(guard.limitPerMinute),
    "X-RateLimit-Remaining": String(guard.remaining),
    "X-RateLimit-Tier": guard.tier,
  }
}

export function publicApiRateLimitedResponse(limited: PublicApiGuardLimited): NextResponse {
  return publicApiJson(limited.body, 429, {
    "Retry-After": String(limited.retryAfter),
    "Cache-Control": "no-store",
  })
}
