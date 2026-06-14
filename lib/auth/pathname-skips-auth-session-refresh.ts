/**
 * Public catalog/marketing routes where anonymous traffic can skip Supabase `getUser()`
 * when no session cookies are present. Protected routes always refresh via
 * {@link pathnameRequiresAuthSession}.
 */
export function pathnameSkipsAuthSessionRefresh(pathname: string): boolean {
  if (pathname === "/") return true
  if (pathname === "/contact") return true
  if (pathname === "/boards") return true
  if (pathname.startsWith("/search")) return true
  if (pathname === "/sold") return true
  if (
    pathname === "/fins" ||
    pathname === "/wetsuits" ||
    pathname === "/accessories" ||
    pathname === "/leashes" ||
    pathname === "/boardbags" ||
    pathname === "/surfpacks" ||
    pathname === "/apparel" ||
    pathname === "/jamboards"
  ) {
    return true
  }
  if (pathname.startsWith("/l/")) return true
  if (pathname.startsWith("/sellers/")) return true
  if (pathname.startsWith("/brands")) return true
  if (pathname === "/privacy" || pathname === "/terms" || pathname === "/cookies") return true
  if (pathname === "/help" || pathname.startsWith("/help/")) return true
  if (pathname === "/sell" || pathname.startsWith("/sell/")) return true
  if (
    pathname === "/auth/login" ||
    pathname === "/auth/sign-up" ||
    pathname.startsWith("/auth/sign-up/")
  ) {
    return true
  }
  return false
}
