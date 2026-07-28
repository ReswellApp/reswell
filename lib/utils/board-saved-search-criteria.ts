import {
  BOARDS_BROWSE_DEFAULT_SORT,
  isBoardsBrowseShippingAvailableParam,
} from "@/lib/marketplace-slug-metadata"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"
import { isUuidString } from "@/lib/utils/isUuid"
import type { BoardDimensionBrowseFields } from "@/lib/utils/board-dimension-browse-filter"
import {
  boardDimensionBrowseSummary,
  hasActiveBoardDimensionBrowseFilters,
} from "@/lib/utils/board-dimension-browse-filter"
import type { BoardsBrowseFacetSelections } from "@/lib/boards-browse-facets"

/** Fields used for /boards browse and saved-search snapshots (excludes geo). */
export type BoardsBrowseFilterFields = {
  q: string
  brand: string
  model: string
  catalogBrandId: string
  catalogBrandModelId: string
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string
  minPrice: string
  maxPrice: string
  type: string
  condition: string
  sort: string
  /** Pro facet multi-selects from the browse URL. */
  facets?: BoardsBrowseFacetSelections
  /** Raw `shipping=` query value, or boolean. */
  shipping?: string | boolean | null
}

function nonEmptyFacetList(values: string[] | undefined): string[] | undefined {
  if (!values || values.length === 0) return undefined
  return values
}

export function boardSavedSearchCriteriaFromFilters(
  f: BoardsBrowseFilterFields,
): BoardSavedSearchCriteria {
  const out: BoardSavedSearchCriteria = { section: "surfboards" }
  const q = f.q.trim()
  if (q) out.q = q
  const brand = f.brand.trim()
  if (brand) out.brand = brand
  const brandId = f.catalogBrandId.trim()
  if (brandId && isUuidString(brandId)) out.brandId = brandId
  const model = f.model.trim()
  if (model) out.model = model
  const brandModelId = f.catalogBrandModelId.trim()
  if (brandModelId && isUuidString(brandModelId)) out.brandModelId = brandModelId
  const dimFields: BoardDimensionBrowseFields = {
    boardLength: f.boardLength,
    boardWidthInches: f.boardWidthInches,
    boardThicknessInches: f.boardThicknessInches,
    boardVolumeL: f.boardVolumeL,
  }
  if (hasActiveBoardDimensionBrowseFilters(dimFields)) {
    out.dimLength = f.boardLength.trim() || undefined
    out.dimWidth = f.boardWidthInches.trim() || undefined
    out.dimThickness = f.boardThicknessInches.trim() || undefined
    out.dimVolume = f.boardVolumeL.trim() || undefined
    const summary = boardDimensionBrowseSummary(dimFields)
    if (summary) out.dimensions = summary
  }
  if (f.type && f.type !== "all") out.type = f.type

  const facets = f.facets
  const styleList = nonEmptyFacetList(facets?.styles)
  if (styleList) out.style = styleList

  const conditionList = nonEmptyFacetList(facets?.conditions)
  if (conditionList) {
    out.conditions = conditionList
    out.condition = conditionList.join(",")
  } else if (f.condition && f.condition !== "all") {
    out.condition = f.condition
  }

  const finList = nonEmptyFacetList(facets?.finSetups)
  if (finList) out.fin = finList
  const finSystemList = nonEmptyFacetList(facets?.finSystems)
  if (finSystemList) out.finSystem = finSystemList
  const constructionList = nonEmptyFacetList(facets?.constructions)
  if (constructionList) out.construction = constructionList
  const lengthList = nonEmptyFacetList(facets?.lengthBuckets)
  if (lengthList) out.length = lengthList
  const volumeList = nonEmptyFacetList(facets?.volumeBuckets)
  if (volumeList) out.volume = volumeList

  const shippingOn =
    typeof f.shipping === "boolean"
      ? f.shipping
      : isBoardsBrowseShippingAvailableParam(f.shipping)
  if (shippingOn) out.shipping = true

  if (f.sort && f.sort !== BOARDS_BROWSE_DEFAULT_SORT) out.sort = f.sort
  const minT = f.minPrice.trim()
  if (minT) {
    const n = Number(minT)
    if (Number.isFinite(n) && n >= 0) out.minPrice = Math.round(n)
  }
  const maxT = f.maxPrice.trim()
  if (maxT) {
    const n = Number(maxT)
    if (Number.isFinite(n) && n >= 0) out.maxPrice = Math.round(n)
  }
  return out
}

export function hasActiveAdvancedBrowseFilters(
  f: Pick<
    BoardsBrowseFilterFields,
    | "brand"
    | "model"
    | "catalogBrandId"
    | "catalogBrandModelId"
    | "boardLength"
    | "boardWidthInches"
    | "boardThicknessInches"
    | "boardVolumeL"
    | "minPrice"
    | "maxPrice"
  >,
): boolean {
  return (
    Boolean(f.brand.trim()) ||
    Boolean(f.model.trim()) ||
    Boolean(f.catalogBrandId.trim()) ||
    Boolean(f.catalogBrandModelId.trim()) ||
    hasActiveBoardDimensionBrowseFilters({
      boardLength: f.boardLength,
      boardWidthInches: f.boardWidthInches,
      boardThicknessInches: f.boardThicknessInches,
      boardVolumeL: f.boardVolumeL,
    }) ||
    Boolean(f.minPrice.trim()) ||
    Boolean(f.maxPrice.trim())
  )
}

export function countActiveAdvancedBrowseFilters(
  f: Pick<
    BoardsBrowseFilterFields,
    | "brand"
    | "model"
    | "catalogBrandId"
    | "catalogBrandModelId"
    | "boardLength"
    | "boardWidthInches"
    | "boardThicknessInches"
    | "boardVolumeL"
    | "minPrice"
    | "maxPrice"
  >,
): number {
  let n = 0
  if (f.brand.trim() || f.catalogBrandId.trim()) n++
  if (f.model.trim() || f.catalogBrandModelId.trim()) n++
  if (
    hasActiveBoardDimensionBrowseFilters({
      boardLength: f.boardLength,
      boardWidthInches: f.boardWidthInches,
      boardThicknessInches: f.boardThicknessInches,
      boardVolumeL: f.boardVolumeL,
    })
  ) {
    n++
  }
  if (f.minPrice.trim() || f.maxPrice.trim()) n++
  return n
}
