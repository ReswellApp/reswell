import {
  facetSelectionsFromParams,
  type BoardsBrowseFacetSelections,
} from "@/lib/boards-browse-facets"
import { normalizeBoardBrowseRadius } from "@/lib/boards-browse-location"
import {
  BOARDS_BROWSE_NEWEST_SORT,
  isBoardsBrowseShippingAvailableParam,
  type BoardsBrowseSearchParams,
} from "@/lib/marketplace-slug-metadata"
import { isBoardsBrowseTopPicksSort } from "@/lib/db/boards-browse-listings"

type SidebarFilterParams = Partial<BoardsBrowseSearchParams> &
  Partial<Record<keyof BoardsBrowseFacetSelections, string | undefined>>

/** Count of active filters from the Filter sidebar/drawer (not keyword search or sort). */
export function boardsBrowseSidebarFilterCount(sp: SidebarFilterParams): number {
  const selections = facetSelectionsFromParams(sp)
  let n = 0
  n += selections.styles.length
  n += selections.conditions.length
  n += selections.finSetups.length
  n += selections.finSystems.length
  n += selections.constructions.length
  n += selections.lengthBuckets.length
  n += selections.volumeBuckets.length
  if (sp.brand?.trim() || sp.brandId?.trim()) n += 1
  if (sp.model?.trim() || sp.brandModelId?.trim()) n += 1
  if (sp.minPrice?.trim() || sp.maxPrice?.trim()) n += 1
  if (sp.location?.trim()) n += 1
  if (normalizeBoardBrowseRadius(sp.radius ?? null) !== "any") n += 1
  if (isBoardsBrowseShippingAvailableParam(sp.shipping)) n += 1
  return n
}

export function boardsBrowseHasSidebarFilters(sp: SidebarFilterParams): boolean {
  return boardsBrowseSidebarFilterCount(sp) > 0
}

/**
 * Daily rotate / Newest shuffle only applies on unfiltered browse. With sidebar filters
 * or a keyword search, fall back to recency (price sorts are unchanged).
 */
export function boardsBrowseEffectiveSort(
  sort: string,
  hasSidebarFilters: boolean,
  hasKeywordQuery = false,
): string {
  if (isBoardsBrowseTopPicksSort(sort) && (hasSidebarFilters || hasKeywordQuery)) {
    return BOARDS_BROWSE_NEWEST_SORT
  }
  return sort
}
