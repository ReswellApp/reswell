import { PEER_LISTING_SECTIONS } from "@/lib/peer-listing-sections"

function isSearchResultsPath(pathname: string | null): boolean {
  return pathname === "/search" || pathname === "/search/recent"
}

/** Boards-standard copy for main nav — same on every route. */
export function headerNavSearchPlaceholder(_section?: string): string {
  return "Search surfboards…"
}

/** Listing sections queried by nav typeahead for a given scope token. */
export function marketplaceSearchSuggestSections(section: string): string[] {
  const normalized = section.trim().toLowerCase()
  if (normalized === "new") return ["new"]
  if (normalized === "fins" || normalized === "wetsuits" || normalized === "magazines") {
    return [normalized]
  }
  if (normalized === "surfboards") return ["surfboards"]
  // Empty / unknown → all peer marketplace categories (main nav default).
  return [...PEER_LISTING_SECTIONS]
}

/** Stable cache key for nav search suggest (`section` query param). */
export type NavSearchSuggestSectionKey =
  | "new"
  | "surfboards"
  | "fins"
  | "wetsuits"
  | "magazines"
  | "marketplace"

export function navSearchSuggestSectionKey(section: string): NavSearchSuggestSectionKey {
  const normalized = section.trim().toLowerCase()
  if (normalized === "new") return "new"
  if (normalized === "fins" || normalized === "wetsuits" || normalized === "magazines") {
    return normalized
  }
  if (normalized === "surfboards") return "surfboards"
  return "marketplace"
}

/**
 * Main nav submit always lands on faceted `/boards` (boards-standard), except when
 * the user is already on legacy `/search` (preserve category chip).
 */
export function headerNavSearchSubmitHref(
  rawQuery: string,
  pathname: string | null,
  categorySource: Pick<URLSearchParams, "get">,
): string {
  const term = rawQuery.trim()
  if (!term) return ""

  // Legacy `/search` stays available for category chips / curated recent.
  if (isSearchResultsPath(pathname)) {
    const params = new URLSearchParams()
    params.set("q", term)
    params.set("nq", "1")
    const category = categorySource.get("category")
    if (category?.trim()) params.set("category", category.trim())
    return `/search?${params.toString()}`
  }

  const params = new URLSearchParams()
  params.set("q", term)
  params.set("nq", "1")
  return `/boards?${params.toString()}`
}
