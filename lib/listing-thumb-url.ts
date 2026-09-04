/**
 * Pair-upload listing thumbs (`*-full.*` + `*-thumb.*`) — no runtime deps so tests can import this file.
 */

/**
 * Sibling thumb object for pair uploads (`*-full.*` → `*-thumb.*`).
 * Returns null when the URL is not a pair-upload full object — do not guess other names.
 */
export function listingDerivedThumbUrlFromFullUrl(
  url: string | null | undefined,
): string | null {
  const t = url?.trim()
  if (!t || !t.includes("-full.")) return null
  return t.replace("-full.", "-thumb.")
}

/**
 * Value to write on `listing_images.thumbnail_url`.
 * Uses an explicit thumb when provided; otherwise the pair-upload sibling of `fullUrl`.
 * Never invents a thumb path for non-pair URLs (those would 404 in the grid).
 */
export function persistableListingThumbnailUrl(
  thumbnailUrl: string | null | undefined,
  fullUrl: string | null | undefined,
): string | null {
  const explicit = typeof thumbnailUrl === "string" ? thumbnailUrl.trim() : ""
  if (explicit) return explicit
  return listingDerivedThumbUrlFromFullUrl(fullUrl)
}

/**
 * True when `thumbnail_url` is a real thumb, not a copy of the full object
 * (legacy imports wrote the same URL into both columns).
 */
export function listingStoredThumbIsDistinctFromFull(
  thumbnailUrl: string | null | undefined,
  fullUrl: string | null | undefined,
): boolean {
  const stored = thumbnailUrl?.trim() ?? ""
  const full = fullUrl?.trim() ?? ""
  return Boolean(stored && stored !== full)
}
