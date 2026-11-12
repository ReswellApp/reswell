import { listingParamFromProductPathname } from "@/lib/klaviyo/page-view-metric"

export { listingParamFromProductPathname as listingParamFromPublicPath }

/**
 * True only for catalog rows guests can see. Matches the `/l/[listing]` public
 * shell (`listing && !hidden_from_site`). Hidden, missing, and lookup failures
 * stay uncached so owner/staff PDPs and the unavailable page cannot be stored
 * as public HTML.
 */
export function shouldCdnCacheListingHtml(input: {
  queryFailed: boolean
  listing: { hidden_from_site?: boolean | null } | null
}): boolean {
  if (input.queryFailed || !input.listing) return false
  return input.listing.hidden_from_site !== true
}
