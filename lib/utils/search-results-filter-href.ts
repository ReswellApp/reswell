import type { ElasticsearchIndexedListingSection } from "@/lib/elasticsearch/listing-sections"
import { marketplaceSectionBrowseHref } from "@/lib/utils/marketplace-brand-query"

/** Build a `/boards` href from a free-text query (nav submit / NL search landing). */
export function boardsSearchHrefFromQuery(
  rawQuery: string,
  options?: {
    brandModelId?: string | null
    brandId?: string | null
    lengthToken?: string | null
    navSubmitted?: boolean
  },
): string {
  const params = new URLSearchParams()
  const q = rawQuery.trim()
  if (q) params.set("q", q)
  if (options?.navSubmitted) params.set("nq", "1")
  if (options?.brandModelId) params.set("brandModelId", options.brandModelId)
  else if (options?.brandId) params.set("brandId", options.brandId)
  if (options?.lengthToken) params.set("dimLength", options.lengthToken)
  const qs = params.toString()
  return qs ? `/boards?${qs}` : "/boards"
}

/**
 * Where the search-results Filter button sends shoppers so they can narrow
 * the same query with the section browse filters.
 */
export function searchResultsFilterHref(input: {
  query: string
  section: ElasticsearchIndexedListingSection | null
  brandModelId?: string | null
  brandId?: string | null
  lengthToken?: string | null
}): string {
  const query = input.query.trim()
  const section = input.section
  const sectionHref = marketplaceSectionBrowseHref(section)

  if (section && section !== "surfboards" && sectionHref) {
    const params = new URLSearchParams()
    if (query) params.set("q", query)
    const qs = params.toString()
    return qs ? `${sectionHref}?${qs}` : sectionHref
  }

  return boardsSearchHrefFromQuery(query, {
    brandModelId: input.brandModelId,
    brandId: input.brandId,
    lengthToken: input.lengthToken,
  })
}
