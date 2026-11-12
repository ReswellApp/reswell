/** Anonymous marketplace HTML stays out of per-user cookies so the CDN can store it. */

export const PUBLIC_MARKETPLACE_EDGE_CACHE_CONTROL =
  "public, s-maxage=3600, stale-while-revalidate=86400"

/**
 * Anonymous `/l/{slug}` HTML. No `stale-while-revalidate` — that window kept
 * sold PDPs live after `revalidatePath`. Next still emits `private, no-store`
 * (cookies in `generateMetadata`, `Date.now` in SSR), so the CDN only stores
 * this document when middleware sets this header. Five minutes is the
 * spend/sale tradeoff: ~545 KB listing HTML was MISS on every request.
 */
export const LISTING_HTML_CDN_CACHE_CONTROL = "public, s-maxage=300"

/**
 * Signed-in `/l/{slug}` HTML. Owners and staff can see hidden listings via
 * `ListingDetailDynamicGate`; guests get the unavailable page. Middleware must
 * set this so the edge bypasses (and does not store) that session-specific
 * document. Skipping the header is not enough — a prior anonymous HIT would
 * still replay.
 */
export const LISTING_HTML_PRIVATE_CACHE_CONTROL = "private, no-store"

/**
 * Browser lifetime for those same documents. The edge may keep HTML (`s-maxage`),
 * but the browser must revalidate so a refresh after a deploy gets new chunk hashes
 * instead of a cached document pointing at deleted `/_next/static` files.
 */
export const BROWSER_HTML_CACHE_CONTROL = "public, max-age=0, must-revalidate"

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
