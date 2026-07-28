import { BOARDS_BROWSE_DEFAULT_SORT } from "@/lib/marketplace-slug-metadata"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"
import { isUuidString } from "@/lib/utils/isUuid"
import {
  appendBoardDimensionBrowseParams,
  boardDimensionBrowseFieldsFromSearchParams,
} from "@/lib/utils/board-dimension-browse-filter"
import { FACET_PARAM_KEYS, facetOptionLabel } from "@/lib/boards-browse-facets"

function setJoinedParam(params: URLSearchParams, key: string, values: string[] | undefined) {
  if (!values || values.length === 0) return
  params.set(key, values.join(","))
}

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

  const conditions =
    criteria.conditions && criteria.conditions.length > 0
      ? criteria.conditions
      : criteria.condition && criteria.condition !== "all"
        ? criteria.condition.split(",").map((s) => s.trim()).filter(Boolean)
        : []
  setJoinedParam(params, FACET_PARAM_KEYS.condition, conditions)

  setJoinedParam(params, FACET_PARAM_KEYS.style, criteria.style)
  setJoinedParam(params, FACET_PARAM_KEYS.finSetup, criteria.fin)
  setJoinedParam(params, FACET_PARAM_KEYS.finSystem, criteria.finSystem)
  setJoinedParam(params, FACET_PARAM_KEYS.construction, criteria.construction)
  setJoinedParam(params, FACET_PARAM_KEYS.length, criteria.length)
  setJoinedParam(params, FACET_PARAM_KEYS.volume, criteria.volume)

  if (criteria.shipping === true) params.set("shipping", "1")

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

function facetSummaryLabels(paramKey: string, values: string[] | undefined, limit = 2): string[] {
  if (!values || values.length === 0) return []
  const labels = values.slice(0, limit).map((v) => facetOptionLabel(paramKey, v))
  if (values.length > limit) labels.push(`+${values.length - limit}`)
  return labels
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

  const styles = criteria.style?.length
    ? criteria.style
    : criteria.type && criteria.type !== "all"
      ? [criteria.type]
      : []
  parts.push(...facetSummaryLabels(FACET_PARAM_KEYS.style, styles))

  const conditions =
    criteria.conditions && criteria.conditions.length > 0
      ? criteria.conditions
      : criteria.condition && criteria.condition !== "all"
        ? criteria.condition.split(",").map((s) => s.trim()).filter(Boolean)
        : []
  parts.push(...facetSummaryLabels(FACET_PARAM_KEYS.condition, conditions))

  parts.push(...facetSummaryLabels(FACET_PARAM_KEYS.finSetup, criteria.fin))
  parts.push(...facetSummaryLabels(FACET_PARAM_KEYS.finSystem, criteria.finSystem))
  parts.push(...facetSummaryLabels(FACET_PARAM_KEYS.construction, criteria.construction))
  parts.push(...facetSummaryLabels(FACET_PARAM_KEYS.length, criteria.length))
  parts.push(...facetSummaryLabels(FACET_PARAM_KEYS.volume, criteria.volume))

  if (criteria.shipping === true) parts.push("ships")

  return parts.length > 0 ? parts.join(" · ") : "Saved search"
}
