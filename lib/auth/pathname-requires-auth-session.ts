/**
 * Pathnames where middleware requires a Supabase session (mirrors {@link updateSession}
 * in lib/supabase/proxy.ts). Keep in sync when adding protected routes.
 *
 * `/sell` is public — guests fill forms; sign-in is required at publish (client gate).
 * `/cart` and `/favorites` are gated in the client via sign-in gates (modal).
 * Do not use pathname.startsWith("/sell") here — that would also match "/sellers".
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
