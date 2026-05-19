import { BOARDS_BROWSE_DEFAULT_SORT } from "@/lib/marketplace-slug-metadata"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"
import { isUuidString } from "@/lib/utils/isUuid"
import {
  appendBoardDimensionBrowseParams,
  boardDimensionBrowseFieldsFromSearchParams,
} from "@/lib/utils/board-dimension-browse-filter"

/** Build a `/boards` href from stored saved-search criteria (excludes geo). */
export function boardSavedSearchCriteriaToBrowseHref(criteria: BoardSavedSearchCriteria): string {
  const params = new URLSearchParams()

  const q = criteria.q?.trim()
  if (q) params.set("q", q)

  const brand = criteria.brand?.trim()
  if (brand) params.set("brand", brand)

  const brandId = criteria.brandId?.trim()
  if (brandId && isUuidString(brandId)) params.set("brandId", brandId)

  const model = criteria.model?.trim()
  if (model) params.set("model", model)

  const brandModelId = criteria.brandModelId?.trim()
  if (brandModelId && isUuidString(brandModelId)) params.set("brandModelId", brandModelId)

  const dimFields = boardDimensionBrowseFieldsFromSearchParams({
    dimLength: criteria.dimLength,
    dimWidth: criteria.dimWidth,
    dimThickness: criteria.dimThickness,
    dimVolume: criteria.dimVolume,
    legacyDimensions: criteria.dimensions,
  })
  appendBoardDimensionBrowseParams(params, dimFields)

  if (criteria.type && criteria.type !== "all") params.set("type", criteria.type)
  if (criteria.condition && criteria.condition !== "all") params.set("condition", criteria.condition)
  if (criteria.sort && criteria.sort !== BOARDS_BROWSE_DEFAULT_SORT) params.set("sort", criteria.sort)

  if (criteria.minPrice != null && Number.isFinite(criteria.minPrice)) {
    params.set("minPrice", String(Math.round(criteria.minPrice)))
  }
  if (criteria.maxPrice != null && Number.isFinite(criteria.maxPrice)) {
    params.set("maxPrice", String(Math.round(criteria.maxPrice)))
  }

  const qs = params.toString()
  return qs ? `/boards?${qs}` : "/boards"
}

/** Short label for saved-search list rows and toasts. */
export function boardSavedSearchCriteriaSummary(criteria: BoardSavedSearchCriteria): string {
  const parts: string[] = []
  if (criteria.q?.trim()) parts.push(`“${criteria.q.trim()}”`)
  if (criteria.brand?.trim()) parts.push(criteria.brand.trim())
  if (criteria.model?.trim()) parts.push(criteria.model.trim())
  if (criteria.dimensions?.trim()) parts.push(criteria.dimensions.trim())
  if (criteria.minPrice != null) parts.push(`from $${criteria.minPrice}`)
  if (criteria.maxPrice != null) parts.push(`up to $${criteria.maxPrice}`)
  if (criteria.type && criteria.type !== "all") parts.push(criteria.type.replace(/-/g, " "))
  if (criteria.condition && criteria.condition !== "all") {
    parts.push(criteria.condition.replace(/-/g, " "))
  }
  return parts.length > 0 ? parts.join(" · ") : "Saved search"
}
