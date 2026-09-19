import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"

export const SAVED_SEARCH_ALERT_KINDS = ["search", "model", "brand"] as const

export type SavedSearchAlertKind = (typeof SAVED_SEARCH_ALERT_KINDS)[number]

type SavedSearchLike = {
  id: string
  criteria: BoardSavedSearchCriteria
}

/** Resolve the Klaviyo `Alert_Kind` for a stored snapshot. */
export function inferSavedSearchAlertKind(
  criteria: BoardSavedSearchCriteria,
): SavedSearchAlertKind {
  if (criteria.alertKind === "model" || criteria.alertKind === "brand" || criteria.alertKind === "search") {
    return criteria.alertKind
  }
  if (criteria.brandModelId?.trim()) return "model"
  if (criteria.brandId?.trim() && !criteria.model?.trim()) return "brand"
  return "search"
}

export function savedSearchMatchesModel(
  criteria: BoardSavedSearchCriteria,
  brandModelId: string,
): boolean {
  const wanted = brandModelId.trim()
  if (!wanted) return false
  return (criteria.brandModelId ?? "").trim() === wanted
}

export function savedSearchMatchesBrand(
  criteria: BoardSavedSearchCriteria,
  brandId: string,
): boolean {
  const wanted = brandId.trim()
  if (!wanted) return false
  if ((criteria.brandModelId ?? "").trim()) return false
  return (criteria.brandId ?? "").trim() === wanted
}

export function findSavedSearchForModel<T extends SavedSearchLike>(
  searches: readonly T[],
  brandModelId: string,
): T | null {
  return searches.find((row) => savedSearchMatchesModel(row.criteria, brandModelId)) ?? null
}

export function findSavedSearchForBrand<T extends SavedSearchLike>(
  searches: readonly T[],
  brandId: string,
): T | null {
  return searches.find((row) => savedSearchMatchesBrand(row.criteria, brandId)) ?? null
}

export function modelSavedSearchCriteria(input: {
  brandName: string
  brandId: string
  brandSlug: string
  modelName: string
  brandModelId: string
  modelSlug: string
  section?: BoardSavedSearchCriteria["section"]
}): BoardSavedSearchCriteria {
  return {
    alertKind: "model",
    section: input.section ?? "surfboards",
    brand: input.brandName,
    brandId: input.brandId,
    brandSlug: input.brandSlug,
    model: input.modelName,
    brandModelId: input.brandModelId,
    modelSlug: input.modelSlug,
  }
}

export function brandSavedSearchCriteria(input: {
  brandName: string
  brandId: string
  brandSlug: string
}): BoardSavedSearchCriteria {
  return {
    alertKind: "brand",
    anySection: true,
    brand: input.brandName,
    brandId: input.brandId,
    brandSlug: input.brandSlug,
  }
}
