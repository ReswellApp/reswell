/**
 * Maps a public pathname to the Klaviyo page-view metric.
 *
 * **Viewed Site Page** is browsing: home, category roots (`/boards`, `/fins`, …),
 * search, brand pages, and the rest of the storefront.
 * Listing product pages (`/l` and `/l/...`) do not emit it.
 * **Viewed Sell Page** stays on `/sell` for the seller funnel.
 */

export type KlaviyoPageViewSegment = "sell" | "site"

export type KlaviyoPageViewMetric = {
  metricName: string
  segment: KlaviyoPageViewSegment
}

/** Product detail routes. `/leashes` and `/listings` are not product pages. */
export function isListingProductPathname(pathname: string): boolean {
  const p = pathname.trim()
  return p === "/l" || p.startsWith("/l/")
}

export function klaviyoPageViewMetricForPathname(
  pathname: string,
): KlaviyoPageViewMetric | null {
  const p = pathname.trim()
  if (isListingProductPathname(p)) return null
  if (p === "/sell" || p.startsWith("/sell/")) {
    return { metricName: "Viewed Sell Page", segment: "sell" }
  }
  return { metricName: "Viewed Site Page", segment: "site" }
}
