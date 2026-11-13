/**
 * Immutable public storage media served via `/media/listings` and `/media/blog`.
 * CDN cache reads/writes are free. Do not also store these bytes in the Next.js
 * Data Cache — that bills ISR write units (8 KB) per unique object.
 */
export const PUBLIC_MEDIA_CACHE_CONTROL =
  "public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=86400"

/** @deprecated Use {@link PUBLIC_MEDIA_CACHE_CONTROL}. */
export const LISTING_MEDIA_CACHE_CONTROL = PUBLIC_MEDIA_CACHE_CONTROL

export function publicMediaCacheHeaders(): Record<string, string> {
  return {
    "Cache-Control": PUBLIC_MEDIA_CACHE_CONTROL,
    "CDN-Cache-Control": PUBLIC_MEDIA_CACHE_CONTROL,
    "Vercel-CDN-Cache-Control": PUBLIC_MEDIA_CACHE_CONTROL,
  }
}
