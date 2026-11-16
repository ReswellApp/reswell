/**
 * Immutable public storage media served via `/media/listings` and `/media/blog`.
 * `s-maxage` + `stale-while-revalidate` keep Vercel’s edge CDN hot so origin
 * misses do not re-fetch Supabase. Photo bodies are not copied into the Data Cache.
 */
export const PUBLIC_MEDIA_CACHE_CONTROL =
  "public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=86400"

/** Browser + Vercel CDN. `CDN-Cache-Control` wins at the edge over a shorter browser max-age. */
export function publicMediaCacheHeaders(): Record<string, string> {
  return {
    "Cache-Control": PUBLIC_MEDIA_CACHE_CONTROL,
    "CDN-Cache-Control":
      "public, s-maxage=31536000, immutable, stale-while-revalidate=86400",
  }
}

/** @deprecated Use {@link PUBLIC_MEDIA_CACHE_CONTROL}. */
export const LISTING_MEDIA_CACHE_CONTROL = PUBLIC_MEDIA_CACHE_CONTROL
