import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"
import { boardSavedSearchCriteriaToBrowseHref } from "@/lib/utils/board-saved-search-browse-url"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"

/**
 * Absolute URL for a saved search, suitable for a Klaviyo event property.
 * Marketplace keyword searches land on `/search?q=…` (spaces as `+`, `'` as `%27`).
 */
export function savedSearchAbsoluteUrl(
  criteria: BoardSavedSearchCriteria,
  origin: string = publicSiteOriginForEmail(),
): string {
  const base = origin.replace(/\/$/, "")
  const path = boardSavedSearchCriteriaToBrowseHref(criteria)
  return `${base}${path.startsWith("/") ? path : `/${path}`}`
}
