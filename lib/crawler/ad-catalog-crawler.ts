import type { NextRequest } from "next/server"

/** Meta / ads crawlers that bulk-fetch PDP and browse URLs for catalog quality checks. */
const AD_CATALOG_CRAWLER_UA_SUBSTRINGS = [
  "meta-externalads",
  "meta-externalfetcher",
] as const

const RATE_LIMIT_WINDOW_MS = 60_000
const PRODUCTION_RATE_LIMIT_MAX_REQUESTS = 120
const DEVELOPMENT_RATE_LIMIT_MAX_REQUESTS = 5_000

type RateBucket = { count: number; resetAt: number }

const rateBuckets = new Map<string, RateBucket>()

function adCatalogRateLimitMax(): number {
  const raw = process.env.AD_CATALOG_CRAWLER_RATE_LIMIT_MAX?.trim()
  if (raw) {
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return process.env.NODE_ENV === "development"
    ? DEVELOPMENT_RATE_LIMIT_MAX_REQUESTS
    : PRODUCTION_RATE_LIMIT_MAX_REQUESTS
}

export function isAdCatalogCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent?.trim()) return false
  const ua = userAgent.toLowerCase()
  return AD_CATALOG_CRAWLER_UA_SUBSTRINGS.some((needle) => ua.includes(needle))
}

function clientIpFromRequest(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp
  return "unknown"
}

/** Per-edge-instance throttle for ad catalog bursts (serverless-safe, not global). */
export function isAdCatalogCrawlerRateLimited(request: NextRequest): boolean {
  const userAgent = request.headers.get("user-agent")
  if (!isAdCatalogCrawler(userAgent)) return false

  const ip = clientIpFromRequest(request)
  const bucketKey = `${ip}:${userAgent.toLowerCase()}`
  const now = Date.now()
  const maxRequests = adCatalogRateLimitMax()
  const bucket = rateBuckets.get(bucketKey)

  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(bucketKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    if (rateBuckets.size > 10_000) {
      for (const [key, value] of rateBuckets) {
        if (now >= value.resetAt) rateBuckets.delete(key)
      }
    }
    return false
  }

  bucket.count += 1
  return bucket.count > maxRequests
}

export type AdCatalogCrawlerAccessDecision =
  | { allowed: true }
  | { allowed: false; status: 429; message: string }

export function evaluateAdCatalogCrawlerAccess(
  request: NextRequest,
): AdCatalogCrawlerAccessDecision {
  if (!isAdCatalogCrawler(request.headers.get("user-agent"))) {
    return { allowed: true }
  }
  if (isAdCatalogCrawlerRateLimited(request)) {
    return { allowed: false, status: 429, message: "Too many requests" }
  }
  return { allowed: true }
}
