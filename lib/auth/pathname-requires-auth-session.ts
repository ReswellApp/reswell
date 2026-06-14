/**
 * Pathnames where middleware requires a Supabase session (mirrors {@link updateSession}
 * in lib/supabase/proxy.ts). Keep in sync when adding protected routes.
 *
 * `/sell` is intentionally public — guests can fill the listing form; auth is gated at
 * publish in the client (see sell-flow-client). Do not use pathname.startsWith("/sell")
 * here — that would also match "/sellers".
 */
export function pathnameRequiresAuthSession(pathname: string): boolean {
  /** Legacy / bookmarked URLs — same hub as /dashboard/offers. */
  const isOffersShortcut =
    pathname === "/offers" || pathname.startsWith("/offers/")
  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/messages") ||
    pathname.startsWith("/admin")

  return isProtectedRoute || isOffersShortcut
}
