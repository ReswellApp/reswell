import { isModelPagePathname } from "@/lib/models/routes"
import {
  PUBLIC_MARKETPLACE_EDGE_CACHE_CONTROL,
  publicMarketplaceCdnCacheControl as cdnCacheControlForPublicHtml,
  shouldAttachDeviceCookieOnDocument as shouldAttachDeviceCookie,
} from "@/lib/crawler/public-marketplace-cache-policy"

export { PUBLIC_MARKETPLACE_EDGE_CACHE_CONTROL }

/**
 * Anonymous marketplace HTML. These documents must not `Set-Cookie` and must not
 * read cookies during render, so the Full Route Cache and the CDN can store one
 * copy for every visitor.
 */
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
    pathname === "/sellers" ||
    pathname === "/surf-shops"
  ) {
    return true
  }
  if (
    pathname.startsWith("/brands/") ||
    pathname.startsWith("/sellers/") ||
    pathname.startsWith("/surf-shops/")
  ) {
    return true
  }
  if (isModelPagePathname(pathname)) return true
  return false
}

export function shouldAttachDeviceCookieOnDocument(pathname: string): boolean {
  return shouldAttachDeviceCookie(isPublicMarketplaceHtmlPath(pathname))
}

export function publicMarketplaceCdnCacheControl(
  pathname: string,
  hasSetCookie: boolean,
): string | null {
  return cdnCacheControlForPublicHtml(isPublicMarketplaceHtmlPath(pathname), hasSetCookie)
}
