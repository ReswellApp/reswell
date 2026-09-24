export type KlaviyoPageViewSegment = "sell" | "boards" | "site" | "listing"

/** Keep in sync with `VIEWED_LISTING_METRIC`. */
const VIEWED_LISTING_METRIC = "Viewed Listing"

const LISTING_PATH = /^\/l\/([^/]+)\/?$/

/** Public listing detail identifier (`/l/{slug-or-id}`). Null for every other path. */
export function listingIdentifierFromPathname(pathname: string): string | null {
  const match = LISTING_PATH.exec(pathname.trim())
  if (!match?.[1]) return null
  let ident = match[1]
  try {
    ident = decodeURIComponent(ident)
  } catch {
    return null
  }
  ident = ident.trim()
  if (!ident || ident === "undefined") return null
  return ident
}

/** Maps a URL to the Klaviyo page-view metric. Listing PDPs are not site-wide views. */
export function klaviyoPageViewMetricForPathname(pathname: string): {
  metricName: string
  segment: KlaviyoPageViewSegment
} {
  const path = pathname.trim()
  if (listingIdentifierFromPathname(path)) {
    return { metricName: VIEWED_LISTING_METRIC, segment: "listing" }
  }
  if (path === "/boards" || path.startsWith("/boards/")) {
    return { metricName: "Viewed Boards Page", segment: "boards" }
  }
  if (path === "/sell" || path.startsWith("/sell/")) {
    return { metricName: "Viewed Sell Page", segment: "sell" }
  }
  return { metricName: "Viewed Site Page", segment: "site" }
}
