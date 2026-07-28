import { ELASTICSEARCH_INDEXED_LISTING_SECTIONS } from "@/lib/elasticsearch/listing-sections"

function isSearchResultsPath(pathname: string | null): boolean {
  return pathname === "/search" || pathname === "/search/recent"
}

const PATH_SCOPED_SECTIONS = ["fins", "wetsuits", "magazines"] as const

type PathScopedSection = (typeof PATH_SCOPED_SECTIONS)[number]

function isPathScopedSection(section: string): section is PathScopedSection {
  return (PATH_SCOPED_SECTIONS as readonly string[]).includes(section)
}

/** Scope header nav typeahead + submit to the category when browsing its browse path. */
export function resolveHeaderNavSearchSection(pathname: string | null): string {
  if (!pathname) return ""
  for (const section of PATH_SCOPED_SECTIONS) {
    if (pathname === `/${section}` || pathname.startsWith(`/${section}/`)) {
      return section
    }
  }
  return ""
}

export function headerNavSearchPlaceholder(section: string): string {
  if (section === "fins") return "Search fins…"
  if (section === "wetsuits") return "Search wetsuits…"
  if (section === "magazines") return "Search magazines…"
  return "Search surfboards…"
}

/** Listing sections queried by nav typeahead for a given scope token. */
export function marketplaceSearchSuggestSections(section: string): string[] {
  const normalized = section.trim().toLowerCase()
  if (normalized === "new") return ["new"]
  if (isPathScopedSection(normalized)) return [normalized]
  if (normalized === "surfboards") return ["surfboards"]
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
  if (isPathScopedSection(normalized)) return normalized
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

  const scoped = resolveHeaderNavSearchSection(pathname)
  if (isPathScopedSection(scoped)) {
    return `/${scoped}?q=${encodeURIComponent(term)}`
  }

  const params = new URLSearchParams()
  params.set("q", term)
  params.set("nq", "1")
  const category = isSearchResultsPath(pathname) ? categorySource.get("category") : null
  if (category?.trim()) params.set("category", category.trim())
  return `/search?${params.toString()}`
}
