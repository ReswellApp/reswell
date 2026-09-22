/** Anonymous marketplace HTML stays out of per-user cookies so the CDN can store it. */

export const PUBLIC_MARKETPLACE_EDGE_CACHE_CONTROL =
  "public, s-maxage=3600, stale-while-revalidate=86400"

export function shouldAttachDeviceCookieOnDocument(isPublicMarketplaceHtml: boolean): boolean {
  return !isPublicMarketplaceHtml
}

/**
 * Edge lifetime for anonymous marketplace HTML. Skip when the response sets a
 * cookie (signed-in session refresh) so that response is not stored for everyone.
 */
export function publicMarketplaceCdnCacheControl(
  isPublicMarketplaceHtml: boolean,
  hasSetCookie: boolean,
): string | null {
  if (!isPublicMarketplaceHtml || hasSetCookie) return null
  return PUBLIC_MARKETPLACE_EDGE_CACHE_CONTROL
}
