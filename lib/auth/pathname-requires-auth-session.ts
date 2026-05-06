/**
 * Pathnames where middleware requires a Supabase session (mirrors {@link updateSession}
 * in lib/supabase/proxy.ts). Keep in sync when adding protected routes.
 *
 * Important: do not use pathname.startsWith("/sell") alone — that matches "/sellers".
 */
export function pathnameRequiresAuthSession(pathname: string): boolean {
  const isPublicSellOgAsset =
    pathname === "/sell/opengraph-image" || pathname === "/sell/twitter-image"
  /** Legacy / bookmarked URLs — same hub as /dashboard/offers. */
  const isOffersShortcut =
    pathname === "/offers" || pathname.startsWith("/offers/")
  const isProtectedRoute =
    pathname === "/sell" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/messages") ||
    pathname.startsWith("/admin") ||
    (pathname.startsWith("/sell/") && !isPublicSellOgAsset)

  return isProtectedRoute || isOffersShortcut
}
