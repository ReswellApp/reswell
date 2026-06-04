/**
 * Immutable public storage media served via `/media/listings` and `/media/blog`.
 * `s-maxage` + `stale-while-revalidate` keep Vercel’s edge CDN hot; pair with
 * `getCachedPublicStorageObject` (under Next.js Data Cache size limits) so origin misses
 * do not re-fetch Supabase every time; larger files still cache at the edge via these headers.
 */
export const PUBLIC_MEDIA_CACHE_CONTROL =
  "public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=86400"

/** @deprecated Use {@link PUBLIC_MEDIA_CACHE_CONTROL}. */
export const LISTING_MEDIA_CACHE_CONTROL = PUBLIC_MEDIA_CACHE_CONTROL
