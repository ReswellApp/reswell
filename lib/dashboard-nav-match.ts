/** Pathname portion of a nav href (strips query string). */
export function dashboardNavPathname(href: string): string {
  const q = href.indexOf("?")
  return (q >= 0 ? href.slice(0, q) : href).replace(/\/$/, "") || "/"
}

/** `tab` query value from a nav href, if present. */
export function dashboardNavTabParam(href: string): string | null {
  const q = href.indexOf("?")
  if (q < 0) return null
  return new URLSearchParams(href.slice(q + 1)).get("tab")
}

/** True when `pathname` is this dashboard href, including nested routes except Overview. */
export function dashboardPathMatchesHref(pathname: string, href: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/"
  const target = dashboardNavPathname(href)

  if (target === "/dashboard") {
    return normalized === "/dashboard"
  }

  if (target === "/messages" || target.startsWith("/messages/")) {
    return normalized === target || normalized.startsWith(`${target}/`)
  }

  return normalized === target || normalized.startsWith(`${target}/`)
}

/**
 * Whether a nav href's optional `tab` query matches the current search params.
 * Links without a `tab` match when the current tab is absent or the default
 * seller tab (`seller` / `received`). Buyer links require `tab=buyer` or `tab=made`.
 */
export function dashboardNavTabMatches(
  href: string,
  searchParams: { get(name: string): string | null },
): boolean {
  const linkTab = dashboardNavTabParam(href)
  const currentRaw = searchParams.get("tab")
  const current = currentRaw?.trim() || null

  const isBuyerTab = (tab: string | null) => tab === "buyer" || tab === "made"
  const isSellerTab = (tab: string | null) =>
    tab === null || tab === "seller" || tab === "received"

  if (linkTab === null) {
    // Bare /dashboard/offers is the seller (Selling) entry.
    if (dashboardNavPathname(href) === "/dashboard/offers") {
      return isSellerTab(current)
    }
    return true
  }

  if (isBuyerTab(linkTab)) return isBuyerTab(current)
  if (isSellerTab(linkTab)) return isSellerTab(current)
  return current === linkTab
}

/**
 * Active state for one nav href among siblings. A longer path match wins, so
 * Profile stays inactive on /dashboard/profile/team. When several links share
 * a path (Offers), the matching `tab` query wins.
 */
export function isMostSpecificDashboardNavMatch(
  pathname: string,
  href: string,
  hrefs: readonly string[],
  searchParams: { get(name: string): string | null } = new URLSearchParams(),
): boolean {
  if (!dashboardPathMatchesHref(pathname, href)) return false
  if (!dashboardNavTabMatches(href, searchParams)) return false

  const target = dashboardNavPathname(href)
  for (const candidate of hrefs) {
    if (candidate === href) continue
    if (!dashboardPathMatchesHref(pathname, candidate)) continue
    if (!dashboardNavTabMatches(candidate, searchParams)) continue

    const other = dashboardNavPathname(candidate)
    if (other.length > target.length) return false

    // Same path: prefer the link whose tab query is more specific / matches better.
    if (other === target) {
      const hrefTab = dashboardNavTabParam(href)
      const otherTab = dashboardNavTabParam(candidate)
      if (hrefTab === null && otherTab !== null) return false
    }
  }
  return true
}
