/** Public URL base for the surfboard brands catalog. */
export const BRANDS_BASE = "/brands"

/** Keyword search URL for surfboard listings (matches nav “View all results” style). */
export function brandKeywordSearchHref(brandDisplayName: string): string {
  const q = brandDisplayName.trim()
  if (!q) return "/search"
  const params = new URLSearchParams()
  params.set("q", q)
  return `/search?${params.toString()}`
}
