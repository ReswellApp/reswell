/** Marketplace category browse roots — keep in sync with `lib/site-category-directory`. */
export const CATEGORY_BROWSE_PATHNAMES = [
  "/boards",
  "/fins",
  "/wetsuits",
  "/boardbags",
  "/surfpacks",
  "/leashes",
  "/apparel",
  "/accessories",
  "/traction",
  "/magazines",
] as const

const CATEGORY_BROWSE_PATHNAME_SET = new Set<string>(CATEGORY_BROWSE_PATHNAMES)

/** `/boards`, `/fins`, `/wetsuits`, and the other marketplace category browse roots. */
export function isCategoryBrowsePathname(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const normalized = pathname.replace(/\/$/, "") || "/"
  return CATEGORY_BROWSE_PATHNAME_SET.has(normalized)
}

/**
 * Soft-nav destinations that must not start at `opacity: 0`.
 * `/l/*` listing photos and category browse tiles/atmosphere images flash white
 * when `NavigationPageGate` applies `page-enter` after leaving a listing.
 */
export function shouldSkipPageEnterAnimation(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  if (pathname === "/l" || pathname.startsWith("/l/")) return true
  return isCategoryBrowsePathname(pathname)
}
