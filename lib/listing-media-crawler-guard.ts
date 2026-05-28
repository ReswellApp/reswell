/** Link-preview / catalog crawlers that must fetch `og:image` and feed `image_link` URLs. */
const SOCIAL_PREVIEW_CRAWLER_UA_SUBSTRINGS = [
  "facebookexternalhit",
  "facebot",
  "meta-externalagent",
  "twitterbot",
  "linkedinbot",
  "slackbot",
  "discordbot",
  "bingpreview",
] as const

const BULK_MEDIA_CRAWLER_UA_SUBSTRINGS = [
  "meta-webindexer",
  "bytespider",
  "petalbot",
  "semrushbot",
  "ahrefsbot",
  "dotbot",
  "baiduspider",
  "yandexbot",
] as const

export function isSocialPreviewMediaCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent?.trim()) return false
  const ua = userAgent.toLowerCase()
  return SOCIAL_PREVIEW_CRAWLER_UA_SUBSTRINGS.some((needle) => ua.includes(needle))
}

export function isListingMediaBulkCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent?.trim()) return false
  const ua = userAgent.toLowerCase()
  return BULK_MEDIA_CRAWLER_UA_SUBSTRINGS.some((needle) => ua.includes(needle))
}

const RATE_LIMIT_WINDOW_MS = 60_000
const PRODUCTION_RATE_LIMIT_MAX_REQUESTS = 180
const DEVELOPMENT_RATE_LIMIT_MAX_REQUESTS = 5_000

type RateBucket = { count: number; resetAt: number }

const rateBuckets = new Map<string, RateBucket>()

function listingMediaRateLimitMax(): number {
  const raw = process.env.LISTING_MEDIA_RATE_LIMIT_MAX_REQUESTS?.trim()
  if (raw) {
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return process.env.NODE_ENV === "development"
    ? DEVELOPMENT_RATE_LIMIT_MAX_REQUESTS
    : PRODUCTION_RATE_LIMIT_MAX_REQUESTS
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

/** `<img>` / CSS background loads from real browsers (not bulk crawlers). */
export function isBrowserListingMediaImageRequest(request: Request): boolean {
  const dest = request.headers.get("sec-fetch-dest")
  if (dest === "image") return true
  const accept = request.headers.get("accept") ?? ""
  return accept.startsWith("image/")
}

/** Best-effort per-instance throttle for abusive clients (serverless-safe, not global). */
export function isListingMediaRateLimited(request: Request): boolean {
  if (isBrowserListingMediaImageRequest(request)) return false

  const ip = clientIpFromRequest(request)
  const now = Date.now()
  const maxRequests = listingMediaRateLimitMax()
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
  return bucket.count > maxRequests
}

export type ListingMediaAccessDecision =
  | { allowed: true }
  | { allowed: false; status: 403 | 429; message: string }

export function evaluateListingMediaAccess(request: Request): ListingMediaAccessDecision {
  const userAgent = request.headers.get("user-agent")
  if (isSocialPreviewMediaCrawler(userAgent)) {
    return { allowed: true }
  }
  if (isListingMediaBulkCrawler(userAgent)) {
    return { allowed: false, status: 403, message: "Forbidden" }
  }
  if (isListingMediaRateLimited(request)) {
    return { allowed: false, status: 429, message: "Too many requests" }
  }
  return { allowed: true }
}
