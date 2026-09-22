/**
 * Whether a client-side pathname should emit marketing / ads page-view beacons.
 * Admin surfaces are excluded so internal tools do not pollute funnels.
 */
export function shouldTrackPublicPageView(
  pathname: string | null | undefined,
): pathname is string {
  if (!pathname || !pathname.startsWith("/")) return false
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return false
  return true
}
