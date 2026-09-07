/** True when post-auth `next` is a sell hub or listing-create URL (`/sell`, `/sell/boards`, …). */
export function isSellFlowReturnPath(path: string): boolean {
  const pathname = (path.split("?")[0] ?? "/").trim()
  return pathname === "/sell" || pathname.startsWith("/sell/")
}

/**
 * True when `next` points at a specific listing (`?edit=`), not just the sell hub.
 * Used so welcome copy does not claim a saved listing that does not exist.
 */
export function isSellListingResumePath(path: string): boolean {
  if (!isSellFlowReturnPath(path)) return false
  const query = path.includes("?") ? path.slice(path.indexOf("?") + 1) : ""
  if (!query) return false
  return Boolean(new URLSearchParams(query).get("edit")?.trim())
}
