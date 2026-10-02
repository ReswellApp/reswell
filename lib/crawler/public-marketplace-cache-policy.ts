/** Anonymous marketplace HTML stays out of per-user cookies so the CDN can store it. */

export const PUBLIC_MARKETPLACE_EDGE_CACHE_CONTROL =
  "public, s-maxage=3600, stale-while-revalidate=86400"

export function shouldAttachDeviceCookieOnDocument(isPublicMarketplaceHtml: boolean): boolean {
  return !isPublicMarketplaceHtml
}

/**
 * Anonymous HTML and its RSC GET may be stored at the edge.
 * Server Actions POST back to the page URL (`/boards`, `/sellers`, …) with a
 * `Next-Action` header. Those bodies are per-visitor. A public CDN lifetime on
 * that response replays one admin's `{ isAdmin: true }` to later guests.
 */
export function isCacheablePublicMarketplaceRequest(
  method: string,
  hasNextActionHeader: boolean,
): boolean {
  if (hasNextActionHeader) return false
  const normalized = method.toUpperCase()
  return normalized === "GET" || normalized === "HEAD"
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
