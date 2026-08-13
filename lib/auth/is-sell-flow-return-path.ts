/** True when post-auth `next` is a sell hub or listing-create URL (`/sell`, `/sell/boards`, …). */
export function isSellFlowReturnPath(path: string): boolean {
  const pathname = (path.split("?")[0] ?? "/").trim()
  return pathname === "/sell" || pathname.startsWith("/sell/")
}
