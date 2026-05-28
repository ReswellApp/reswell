/** Immutable listing photos — long CDN TTL with explicit edge caching. */
export const LISTING_MEDIA_CACHE_CONTROL =
  "public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=86400"
