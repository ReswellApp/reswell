import { BOARDS_BROWSE_DEFAULT_SORT } from "@/lib/marketplace-slug-metadata"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"
import { isUuidString } from "@/lib/utils/isUuid"

/** Fields used for /boards browse and saved-search snapshots (excludes geo). */
export type BoardsBrowseFilterFields = {
  q: string
  brand: string
  model: string
  catalogBrandId: string
  catalogBrandModelId: string
  dimensions: string
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
  const dimensions = f.dimensions.trim()
  if (dimensions) out.dimensions = dimensions
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
    "brand" | "model" | "catalogBrandId" | "catalogBrandModelId" | "dimensions" | "minPrice" | "maxPrice"
  >,
): boolean {
  return (
    Boolean(f.brand.trim()) ||
    Boolean(f.model.trim()) ||
    Boolean(f.catalogBrandId.trim()) ||
    Boolean(f.catalogBrandModelId.trim()) ||
    Boolean(f.dimensions.trim()) ||
    Boolean(f.minPrice.trim()) ||
    Boolean(f.maxPrice.trim())
  )
}

export function countActiveAdvancedBrowseFilters(
  f: Pick<
    BoardsBrowseFilterFields,
    "brand" | "model" | "catalogBrandId" | "catalogBrandModelId" | "dimensions" | "minPrice" | "maxPrice"
  >,
): number {
  let n = 0
  if (f.brand.trim() || f.catalogBrandId.trim()) n++
  if (f.model.trim() || f.catalogBrandModelId.trim()) n++
  if (f.dimensions.trim()) n++
  if (f.minPrice.trim() || f.maxPrice.trim()) n++
  return n
}
