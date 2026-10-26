/** Routes where the browse search bar would crowd checkout, forms, or focused tasks. */
export function isSearchHeaderHidden(pathname: string): boolean {
  if (pathname === "/sign-in") return true
  if (pathname === "/account/cart" || pathname === "/account/checkout") return true
  if (pathname === "/sell" || pathname.startsWith("/sell/")) return true
  if (pathname.startsWith("/account/messages/")) return true
  return false
}
