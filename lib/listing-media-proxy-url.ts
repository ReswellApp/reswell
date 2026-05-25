/** Same-origin listing photo proxy — see `app/media/listings/[...path]/route.ts`. */
export const LISTING_MEDIA_PROXY_PATH_PREFIX = "/media/listings/" as const

export function isProxiedListingMediaSrc(src: string | null | undefined): boolean {
  return typeof src === "string" && src.startsWith(LISTING_MEDIA_PROXY_PATH_PREFIX)
}

/**
 * Listing photos are pre-sized WebP in Supabase; skip Vercel Image Optimization for
 * same-origin proxy URLs to avoid transformation + cache-write charges.
 */
export function listingImageShouldBypassOptimization(src: string | null | undefined): boolean {
  return isProxiedListingMediaSrc(src)
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
 * Same-origin path served by `app/media/listings/[...path]/route.ts` so `next/image`
 * optimizer URLs hide the Supabase project host.
 */
export function proxiedListingImageSrc(url: string | null | undefined): string {
  if (url == null) return ""
  const t = String(url).trim()
  if (!t) return ""
  const path = listingStorageObjectPathFromUrl(t)
  if (!path) return t
  return `${LISTING_MEDIA_PROXY_PATH_PREFIX}${path}`
}
