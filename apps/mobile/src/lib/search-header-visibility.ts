/** Routes where the browse search bar would crowd a focused task. */
export function isSearchHeaderHidden(pathname: string): boolean {
  if (pathname === "/sign-in") return true
  if (pathname === "/sell" || pathname.startsWith("/sell/")) return true
  return false
}
