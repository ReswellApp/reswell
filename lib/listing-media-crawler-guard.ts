const BULK_MEDIA_CRAWLER_UA_SUBSTRINGS = [
  "facebookexternalhit",
  "facebot",
  "meta-externalagent",
  "meta-webindexer",
  "bytespider",
  "petalbot",
  "semrushbot",
  "ahrefsbot",
  "dotbot",
  "baiduspider",
  "yandexbot",
  "bingpreview",
] as const

export function isListingMediaBulkCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent?.trim()) return false
  const ua = userAgent.toLowerCase()
  return BULK_MEDIA_CRAWLER_UA_SUBSTRINGS.some((needle) => ua.includes(needle))
}

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 180

type RateBucket = { count: number; resetAt: number }

const rateBuckets = new Map<string, RateBucket>()

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

/** Best-effort per-instance throttle for abusive clients (serverless-safe, not global). */
export function isListingMediaRateLimited(request: Request): boolean {
  const ip = clientIpFromRequest(request)
  const now = Date.now()
  const bucket = rateBuckets.get(ip)

  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    if (rateBuckets.size > 10_000) {
      for (const [key, value] of rateBuckets) {
        if (now >= value.resetAt) rateBuckets.delete(key)
      }
    }
    return false
  }

  bucket.count += 1
  return bucket.count > RATE_LIMIT_MAX_REQUESTS
}

export type ListingMediaAccessDecision =
  | { allowed: true }
  | { allowed: false; status: 403 | 429; message: string }

export function evaluateListingMediaAccess(request: Request): ListingMediaAccessDecision {
  const userAgent = request.headers.get("user-agent")
  if (isListingMediaBulkCrawler(userAgent)) {
    return { allowed: false, status: 403, message: "Forbidden" }
  }
  if (isListingMediaRateLimited(request)) {
    return { allowed: false, status: 429, message: "Too many requests" }
  }
  return { allowed: true }
}
