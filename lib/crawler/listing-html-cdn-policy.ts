import { listingParamFromProductPathname } from "@/lib/klaviyo/page-view-metric"

export { listingParamFromProductPathname as listingParamFromPublicPath }

/**
 * Same branch as `app/l/[listing]/page.tsx`: the hourly public cache has a
 * visible row, so this request renders `ListingDetailPublicOrAuthenticated`.
 * A cache miss (`listing == null`) is `ListingDetailDynamicGate` even when a
 * live row exists.
 */
export function listingRendersAnonymousPublicShell(
  listing: { hidden_from_site?: boolean | null } | null,
): boolean {
  return Boolean(listing && listing.hidden_from_site !== true)
}

/**
 * True only for catalog rows guests can see. Hidden, missing, and lookup
 * failures stay uncached so owner/staff PDPs and the unavailable page cannot
 * be stored as public HTML.
 */
export function shouldCdnCacheListingHtml(input: {
  queryFailed: boolean
  listing: { hidden_from_site?: boolean | null } | null
}): boolean {
  if (input.queryFailed) return false
  return listingRendersAnonymousPublicShell(input.listing)
}

/**
 * Public listing CDN header. Skip when this request already has a session
 * (owner/logged-in DynamicGate HTML often has no Set-Cookie) or when the
 * hourly cache would not render the anonymous public shell.
 */
export function shouldAttachListingCdnCacheHeader(input: {
  hasSetCookie: boolean
  hasRequestSession: boolean
  cachedPublicListing: { hidden_from_site?: boolean | null } | null
}): boolean {
  if (input.hasSetCookie || input.hasRequestSession) return false
  return listingRendersAnonymousPublicShell(input.cachedPublicListing)
}
