/** Public URL base for the surfers directory. */
export const SURFERS_BASE = "/surfers"

/** Keyword search URL for marketplace listings mentioning this person. */
export function surferKeywordSearchHref(displayName: string): string {
  const q = displayName.trim()
  if (!q) return "/search"
  const params = new URLSearchParams()
  params.set("q", q)
  return `/search?${params.toString()}`
}
