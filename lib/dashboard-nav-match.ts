/** True when `pathname` is this dashboard href, including nested routes except Overview. */
export function dashboardPathMatchesHref(pathname: string, href: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/"
  const target = href.replace(/\/$/, "") || "/"

  if (target === "/dashboard") {
    return normalized === "/dashboard"
  }

  if (target === "/messages" || target.startsWith("/messages/")) {
    return normalized === target || normalized.startsWith(`${target}/`)
  }

  return normalized === target || normalized.startsWith(`${target}/`)
}

/**
 * Active state for one nav href among siblings. A longer match wins, so
 * Profile stays inactive on /dashboard/profile/team.
 */
export function isMostSpecificDashboardNavMatch(
  pathname: string,
  href: string,
  hrefs: readonly string[],
): boolean {
  if (!dashboardPathMatchesHref(pathname, href)) return false
  const target = href.replace(/\/$/, "") || "/"
  for (const candidate of hrefs) {
    const other = candidate.replace(/\/$/, "") || "/"
    if (other.length <= target.length) continue
    if (dashboardPathMatchesHref(pathname, other)) return false
  }
  return true
}
