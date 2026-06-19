import { ELASTICSEARCH_INDEXED_LISTING_SECTIONS } from "@/lib/elasticsearch/listing-sections"

function isSearchResultsPath(pathname: string | null): boolean {
  return pathname === "/search" || pathname === "/search/recent"
}

/** Scope header nav typeahead + submit to fins when browsing `/fins`. */
export function resolveHeaderNavSearchSection(pathname: string | null): string {
  if (pathname === "/fins" || pathname?.startsWith("/fins/")) return "fins"
  return ""
}

export function headerNavSearchPlaceholder(section: string): string {
  if (section === "fins") return "Search fins…"
  return "Search surfboards…"
}

/** Listing sections queried by nav typeahead for a given scope token. */
export function marketplaceSearchSuggestSections(section: string): string[] {
  const normalized = section.trim().toLowerCase()
  if (normalized === "new") return ["new"]
  if (normalized === "fins") return ["fins"]
  if (normalized === "surfboards") return ["surfboards"]
  return [...ELASTICSEARCH_INDEXED_LISTING_SECTIONS]
}

/** Stable cache key for nav search suggest (`section` query param). */
export type NavSearchSuggestSectionKey = "new" | "surfboards" | "fins" | "marketplace"

export function navSearchSuggestSectionKey(section: string): NavSearchSuggestSectionKey {
  const normalized = section.trim().toLowerCase()
  if (normalized === "new") return "new"
  if (normalized === "fins") return "fins"
  if (normalized === "surfboards") return "surfboards"
  return "marketplace"
}

export function headerNavSearchSubmitHref(
  rawQuery: string,
  pathname: string | null,
  categorySource: Pick<URLSearchParams, "get">,
): string {
  const term = rawQuery.trim()
  if (!term) return ""

  if (resolveHeaderNavSearchSection(pathname) === "fins") {
    return `/fins?q=${encodeURIComponent(term)}`
  }

  const params = new URLSearchParams()
  params.set("q", term)
  params.set("nq", "1")
  const category = isSearchResultsPath(pathname) ? categorySource.get("category") : null
  if (category?.trim()) params.set("category", category.trim())
  return `/search?${params.toString()}`
}
