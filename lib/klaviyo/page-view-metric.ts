/**
 * Maps a public pathname to the Klaviyo page-view metric.
 *
 * **Viewed Site Page** is browsing: home, category roots (`/boards`, `/fins`, …),
 * search, brand pages, and the rest of the storefront.
 * **Viewed Product** is a listing page (`/l/{slug-or-id}`).
 * **Viewed Sell Page** stays on `/sell` for the seller funnel.
 */

export type KlaviyoPageViewSegment = "sell" | "site" | "product"

export type KlaviyoPageViewMetric = {
  metricName: string
  segment: KlaviyoPageViewSegment
}

/** Product detail routes. `/leashes` and `/listings` are not product pages. */
export function isListingProductPathname(pathname: string): boolean {
  const p = pathname.trim()
  return p === "/l" || p.startsWith("/l/")
}

/** Slug or id from `/l/{slug-or-id}`. Bare `/l` has no product. */
export function listingParamFromProductPathname(pathname: string): string | null {
  const p = pathname.trim()
  if (!p.startsWith("/l/")) return null
  const rest = p.slice("/l/".length).replace(/\/+$/, "")
  if (!rest || rest.includes("/")) return null
  try {
    return decodeURIComponent(rest)
  } catch {
    return rest
  }
}

export function klaviyoPageViewMetricForPathname(
  pathname: string,
): KlaviyoPageViewMetric | null {
  const p = pathname.trim()
  if (isListingProductPathname(p)) {
    if (!listingParamFromProductPathname(p)) return null
    return { metricName: "Viewed Product", segment: "product" }
  }
  if (p === "/sell" || p.startsWith("/sell/")) {
    return { metricName: "Viewed Sell Page", segment: "sell" }
  }
  return { metricName: "Viewed Site Page", segment: "site" }
}
