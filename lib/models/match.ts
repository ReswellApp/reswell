import { findBrandModelBySlug, modelPageSlug } from "./routes.ts"

/** Short catalog names like "Fish" or "OP1" over-match titles; skip text fallback for those. */
export function canUseModelTextFallback(modelName: string): boolean {
  const name = modelName.trim()
  return name.length >= 6 || name.includes(" ")
}

export function listingTitleMatchesModel(title: string, modelName: string): boolean {
  const name = modelName.trim()
  const rawTitle = title.trim()
  if (!name || !rawTitle) return false
  if (rawTitle.toLowerCase().includes(name.toLowerCase())) return true

  const titleSlug = modelPageSlug(rawTitle)
  const slug = modelPageSlug(name)
  if (!slug) return false
  return (
    titleSlug === slug ||
    titleSlug.endsWith(`-${slug}`) ||
    titleSlug.includes(`-${slug}-`)
  )
}

/** Exact catalog row for a listing model field — slug or case-insensitive name. */
export function matchCatalogModelForListingPage<T extends { name: string }>(
  models: readonly T[],
  modelName: string,
): T | null {
  const name = modelName.trim()
  if (!name) return null
  return (
    findBrandModelBySlug(models, modelPageSlug(name)) ??
    models.find((model) => model.name.trim().toLowerCase() === name.toLowerCase()) ??
    null
  )
}
