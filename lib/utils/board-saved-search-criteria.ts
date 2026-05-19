import { BOARDS_BROWSE_DEFAULT_SORT } from "@/lib/marketplace-slug-metadata"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"
import { isUuidString } from "@/lib/utils/isUuid"
import type { BoardDimensionBrowseFields } from "@/lib/utils/board-dimension-browse-filter"
import {
  boardDimensionBrowseSummary,
  hasActiveBoardDimensionBrowseFilters,
} from "@/lib/utils/board-dimension-browse-filter"

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
}

export function boardSavedSearchCriteriaFromFilters(
  f: BoardsBrowseFilterFields,
): BoardSavedSearchCriteria {
  const out: BoardSavedSearchCriteria = {}
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
  if (f.condition && f.condition !== "all") out.condition = f.condition
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
