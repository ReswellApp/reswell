/** Canonical community forums routes at `/threads`. */
export function isThreadsRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return pathname === "/threads" || pathname.startsWith("/threads/")
}
