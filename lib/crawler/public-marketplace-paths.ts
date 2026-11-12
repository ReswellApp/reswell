import { isModelPagePathname } from "@/lib/models/routes"
import {
  BROWSER_HTML_CACHE_CONTROL,
  LISTING_HTML_CDN_CACHE_CONTROL,
  PUBLIC_MARKETPLACE_EDGE_CACHE_CONTROL,
  isCacheablePublicMarketplaceRequest,
  publicMarketplaceCdnCacheControl as cdnCacheControlForPublicHtml,
  shouldAttachDeviceCookieOnDocument as shouldAttachDeviceCookie,
} from "@/lib/crawler/public-marketplace-cache-policy"

export {
  BROWSER_HTML_CACHE_CONTROL,
  LISTING_HTML_CDN_CACHE_CONTROL,
  PUBLIC_MARKETPLACE_EDGE_CACHE_CONTROL,
  isCacheablePublicMarketplaceRequest,
}

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
  if (pathname.startsWith("/pricing/brand/")) return true
  if (isModelPagePathname(pathname)) return true
  return false
}

/** Public media is cacheable at the edge. A Set-Cookie here forces a CDN BYPASS. */
export function isPublicMediaPath(pathname: string): boolean {
  return pathname === "/media" || pathname.startsWith("/media/")
}

export function shouldAttachDeviceCookieOnDocument(pathname: string): boolean {
  if (isPublicMediaPath(pathname)) return false
  return shouldAttachDeviceCookie(isPublicMarketplaceHtmlPath(pathname))
}

export function publicMarketplaceCdnCacheControl(
  pathname: string,
  hasSetCookie: boolean,
  options?: { isAnonymousPublicListingHtml?: boolean; hasRequestSession?: boolean },
): string | null {
  // `/sold` stays uncached (`force-dynamic`). `/l/` is only cached when this
  // response is the anonymous public shell — never DynamicGate (owner/staff
  // or unavailable) and never a request that already has a session cookie.
  // No stale-while-revalidate so sold PDPs cannot linger for a day.
  if (pathname === "/sold") return null
  if (pathname.startsWith("/l/")) {
    if (
      hasSetCookie ||
      options?.hasRequestSession ||
      !options?.isAnonymousPublicListingHtml
    ) {
      return null
    }
    return LISTING_HTML_CDN_CACHE_CONTROL
  }
  return cdnCacheControlForPublicHtml(isPublicMarketplaceHtmlPath(pathname), hasSetCookie)
}
