/**
 * Legacy pathname whitelist for skipping middleware session refresh.
 * Middleware now skips GoTrue for **all** public routes when no auth cookies are present
 * (see lib/supabase/proxy.ts). Kept for reference if finer-grained control is needed again.
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
    pathname.startsWith("/auth/sign-up/") ||
    pathname === "/auth/completing"
  ) {
    return true
  }
  return false
}
