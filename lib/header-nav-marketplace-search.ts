import { ELASTICSEARCH_INDEXED_LISTING_SECTIONS } from "@/lib/elasticsearch/listing-sections"

/** Marketplace-wide copy for main nav — same on every route. */
export function headerNavSearchPlaceholder(_section?: string): string {
  return "Search surfboards, fins, wetsuits or magazines…"
}

/** Listing sections queried by nav typeahead for a given scope token. */
export function marketplaceSearchSuggestSections(section: string): string[] {
  const normalized = section.trim().toLowerCase()
  if (normalized === "new") return ["new"]
  if (normalized === "fins" || normalized === "wetsuits" || normalized === "magazines") {
    return [normalized]
  }
  if (normalized === "surfboards") return ["surfboards"]
  // Empty / marketplace → every section indexed in Elasticsearch.
  return [...ELASTICSEARCH_INDEXED_LISTING_SECTIONS]
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
 * Main nav submit always lands on marketplace-wide `/search` (all ES-indexed
 * sections). Pathname and category chips do not scope results.
 */
export function headerNavSearchSubmitHref(
  rawQuery: string,
  _pathname?: string | null,
  _categorySource?: Pick<URLSearchParams, "get">,
): string {
  const term = rawQuery.trim()
  if (!term) return ""

  const params = new URLSearchParams()
  params.set("q", term)
  params.set("nq", "1")
  return `/search?${params.toString()}`
}
