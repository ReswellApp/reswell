import { absoluteUrl } from "@/lib/site-metadata"

/** Same-origin listing photo proxy — see `app/media/listings/[...path]/route.ts`. */
export const LISTING_MEDIA_PROXY_PATH_PREFIX = "/media/listings/" as const

/** Resize hint for legacy full-res listing objects without a stored thumb file. */
export const LISTING_MEDIA_TILE_VARIANT_PARAM = "tile" as const

export function isProxiedListingMediaSrc(src: string | null | undefined): boolean {
  return typeof src === "string" && src.startsWith(LISTING_MEDIA_PROXY_PATH_PREFIX)
}

/**
 * Pre-sized storage served via `/media/*` proxies; skip Vercel Image Optimization to
 * avoid transformation + cache-write charges.
 */
export function listingImageShouldBypassOptimization(src: string | null | undefined): boolean {
  return typeof src === "string" && src.startsWith("/media/")
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

/** Appends `?variant=tile` so `/media/listings` can serve a cached 640px WebP for browse grids. */
export function withListingMediaTileVariant(src: string): string {
  const t = src.trim()
  if (!t || !t.startsWith(LISTING_MEDIA_PROXY_PATH_PREFIX)) return t
  if (t.includes("variant=")) return t
  const sep = t.includes("?") ? "&" : "?"
  return `${t}${sep}variant=${LISTING_MEDIA_TILE_VARIANT_PARAM}`
}

/** Absolute `https://reswell.app/media/listings/...` for OG tags, catalog feeds, and crawlers. */
export function absoluteProxiedListingMediaUrl(url: string | null | undefined): string | undefined {
  const proxied = proxiedListingImageSrc(url)
  if (!proxied.trim()) return undefined
  if (/^https?:\/\//i.test(proxied)) return proxied
  return absoluteUrl(proxied)
}
