import { absoluteUrl } from "@/lib/site-metadata"

/** Same-origin listing photo proxy — see `app/media/listings/[...path]/route.ts`. */
export const LISTING_MEDIA_PROXY_PATH_PREFIX = "/media/listings/" as const

/** Same-origin listing video stream — see `app/media/listing-videos/[...path]/route.ts`. */
export const LISTING_VIDEO_PROXY_PATH_PREFIX = "/media/listing-videos/" as const

/** Resize hint for legacy full-res listing objects without a stored thumb file. */
export const LISTING_MEDIA_TILE_VARIANT_PARAM = "tile" as const

/** Resize hint for the listing detail hero (≤1024px long edge WebP). */
export const LISTING_MEDIA_PDP_VARIANT_PARAM = "pdp" as const

/** High-quality WebP for Google Merchant image_link (≤1600px long edge). */
export const LISTING_MEDIA_MERCHANT_VARIANT_PARAM = "merchant" as const

export function isProxiedListingMediaSrc(src: string | null | undefined): boolean {
  return typeof src === "string" && src.startsWith(LISTING_MEDIA_PROXY_PATH_PREFIX)
}

/**
 * Pre-sized storage served via `/media/*` proxies; skip Vercel Image Optimization to
 * avoid transformation + cache-write charges.
 */
export function listingImageShouldBypassOptimization(src: string | null | undefined): boolean {
  if (typeof src !== "string" || !src) return false
  return (
    src.startsWith("/media/") ||
    src.startsWith("blob:") ||
    src.startsWith("data:")
  )
}

const PUBLIC_LISTINGS_MARKER = "/storage/v1/object/public/listings/"

function isOurListingStorageHost(hostname: string): boolean {
  return hostname === "app.reswell.app" || hostname.endsWith(".supabase.co")
}

/**
 * Returns the object path inside the `listings` bucket (e.g. `userId/file.webp`)
 * when `url` is a known Supabase (or app.reswell.app) public listing object URL.
 */
export function listingStorageObjectPathFromUrl(url: string): string | null {
  const s = url.trim()
  if (!s) return null
  let parsed: URL
  try {
    parsed = new URL(s)
  } catch {
    return null
  }
  if (!isOurListingStorageHost(parsed.hostname)) return null
  const idx = parsed.pathname.indexOf(PUBLIC_LISTINGS_MARKER)
  if (idx === -1) return null
  const path = parsed.pathname.slice(idx + PUBLIC_LISTINGS_MARKER.length)
  if (!path || path.includes("..")) return null
  return path
}

/**
 * Same-origin path served by `app/media/listings/[...path]/route.ts` so listing photos
 * use `reswell.app/media/listings/...` instead of exposing the Supabase project host.
 */
export function proxiedListingImageSrc(url: string | null | undefined): string {
  if (url == null) return ""
  const t = String(url).trim()
  if (!t) return ""
  const path = listingStorageObjectPathFromUrl(t)
  if (!path) return t
  return `${LISTING_MEDIA_PROXY_PATH_PREFIX}${path}`
}

function withListingMediaVariant(src: string, variant: string): string {
  const t = src.trim()
  if (!t || !t.startsWith(LISTING_MEDIA_PROXY_PATH_PREFIX)) return t
  if (t.includes("variant=")) return t
  const sep = t.includes("?") ? "&" : "?"
  return `${t}${sep}variant=${variant}`
}

/** Appends `?variant=tile` so `/media/listings` can serve a cached 640px WebP for browse grids. */
export function withListingMediaTileVariant(src: string): string {
  return withListingMediaVariant(src, LISTING_MEDIA_TILE_VARIANT_PARAM)
}

/** Appends `?variant=pdp` so `/media/listings` serves a cached ≤1024px WebP for the PDP hero. */
export function withListingMediaPdpVariant(src: string): string {
  return withListingMediaVariant(src, LISTING_MEDIA_PDP_VARIANT_PARAM)
}

/** Appends `?variant=merchant` for catalog feeds (≤1600px long edge WebP). */
export function withListingMediaMerchantVariant(src: string): string {
  return withListingMediaVariant(src, LISTING_MEDIA_MERCHANT_VARIANT_PARAM)
}

export function listingStorageObjectPathFromProxiedSrc(
  src: string | null | undefined,
): string | null {
  const t = src?.trim()
  if (!t || !t.startsWith(LISTING_MEDIA_PROXY_PATH_PREFIX)) return null
  const path = t.slice(LISTING_MEDIA_PROXY_PATH_PREFIX.length).split("?")[0]?.split("#")[0]
  if (!path || path.includes("..")) return null
  return path
}

/** Direct Supabase public URL for a listings-bucket object (bypasses the /media proxy). */
export function listingPublicStorageObjectUrl(objectPath: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "")
  const path = objectPath.trim()
  if (!base || !path || path.includes("..")) return null
  const encoded = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
  return `${base}/storage/v1/object/public/listings/${encoded}`
}

function listingBucketObjectPathFromRaw(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  return (
    listingStorageObjectPathFromUrl(trimmed) ??
    listingStorageObjectPathFromProxiedSrc(proxiedListingImageSrc(trimmed))
  )
}

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * Direct public storage URL when `raw` resolves to a listings-bucket object.
 * Used by catalog feeds when a static file exists (no on-demand ?variant= resize).
 */
export function listingDirectPublicImageUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const objectPath = listingBucketObjectPathFromRaw(raw)
  if (!objectPath) return null
  return listingPublicStorageObjectUrl(objectPath)
}

/**
 * Same-origin PDP video URL. Streams via `/media/listing-videos` so Chrome gets a
 * playable Content-Type (QuickTime objects are advertised as `video/mp4`) and Range
 * requests are not buffered through the image cache.
 */
export function listingPdpVideoPlaybackSrc(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? ""
  if (!trimmed) return ""
  const objectPath = listingBucketObjectPathFromRaw(trimmed)
  if (!objectPath) return trimmed
  const encoded = objectPath
    .split("/")
    .map((segment) => encodeURIComponent(decodePathSegment(segment)))
    .join("/")
  return `${LISTING_VIDEO_PROXY_PATH_PREFIX}${encoded}`
}

/**
 * Prefer the full-res storage object when a row only has a `-thumb.` URL.
 * Pair uploads store `*-full.*` beside `*-thumb.webp`.
 */
export function listingFullImageUrlFromRef(url: string | null | undefined): string | null {
  const t = url?.trim()
  if (!t) return null
  if (t.includes("-thumb.")) return t.replace("-thumb.", "-full.")
  return t
}

/** Absolute `https://reswell.app/media/listings/...` for OG tags, catalog feeds, and crawlers. */
export function absoluteProxiedListingMediaUrl(url: string | null | undefined): string | undefined {
  const proxied = proxiedListingImageSrc(url)
  if (!proxied.trim()) return undefined
  if (/^https?:\/\//i.test(proxied)) return proxied
  return absoluteUrl(proxied)
}
