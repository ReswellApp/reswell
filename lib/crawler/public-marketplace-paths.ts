/** Public marketplace HTML routes that benefit from edge cache hints for catalog crawlers. */
export function isPublicMarketplaceHtmlPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/boards" || pathname === "/sold") return true
  if (pathname.startsWith("/l/")) return true
  if (
    pathname === "/fins" ||
    pathname === "/wetsuits" ||
    pathname === "/boardbags" ||
    pathname === "/surfpacks" ||
    pathname === "/leashes" ||
    pathname === "/apparel" ||
    pathname === "/accessories" ||
    pathname === "/brands" ||
    pathname === "/sellers"
  ) {
    return true
  }
  if (pathname.startsWith("/brands/") || pathname.startsWith("/sellers/")) return true
  return false
}

export const PUBLIC_MARKETPLACE_EDGE_CACHE_CONTROL =
  "public, s-maxage=3600, stale-while-revalidate=86400"
