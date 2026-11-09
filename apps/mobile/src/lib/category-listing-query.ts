import {
  MOBILE_BOARD_TYPES,
  type MobileBoardType,
  type MobileCategoryListingsQuery,
  type MobileCategorySortId,
} from "@reswell/api-contract"
import type { CategoryPlace, CategoryRadius } from "@/components/category-location-filter"

export type SelectedFacets = Record<string, string[]>

/** Query string for the category listings API. Same fields the category screen already sends. */
export function categoryListingQuery(
  offset: number,
  sort: MobileCategorySortId,
  shipping: boolean,
  selected: SelectedFacets,
  boardType: string | undefined,
  place: CategoryPlace | null,
  radius: CategoryRadius,
): Partial<MobileCategoryListingsQuery> & { offset: number } {
  const query: Partial<MobileCategoryListingsQuery> & { offset: number } = { offset, sort }
  if (shipping) query.shipping = "1"
  if (isBoardType(boardType)) query.type = boardType
  if (place?.label) {
    query.location = place.label
    if (place.lat != null && place.lng != null) {
      query.lat = place.lat
      query.lng = place.lng
    }
    if (radius !== "any") query.radius = radius
  }
  for (const [key, values] of Object.entries(selected)) {
    if (values.length === 0) continue
    const joined = values.join(",")
    if (key === "style") query.style = joined
    else if (key === "condition") query.condition = joined
    else if (key === "fin") query.fin = joined
    else if (key === "finSystem") query.finSystem = joined
    else if (key === "construction") query.construction = joined
    else if (key === "length") query.length = joined
    else if (key === "volume") query.volume = joined
    else if (key === "size") query.size = joined
    else if (key === "kind") query.kind = joined
  }
  return query
}

export function isBoardType(value: string | undefined): value is MobileBoardType {
  return (MOBILE_BOARD_TYPES as readonly string[]).includes(value ?? "")
}
