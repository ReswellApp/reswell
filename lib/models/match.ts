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

/**
 * Whether a marketplace listing belongs on a catalog model page.
 * Tagged `brand_model_id` wins. Untagged rows match title or seller model text,
 * but a longer sibling name ("Lane Splitter Swallow") keeps the listing off the
 * shorter parent page ("Lane Splitter").
 */
export function listingBelongsToCatalogModel(
  listing: {
    title?: string | null
    model?: string | null
    brand_model_id?: string | null
  },
  catalogModel: { id: string; name: string },
  siblingModels: readonly { id: string; name: string }[] = [],
): boolean {
  const linkedId = listing.brand_model_id?.trim() ?? ""
  if (linkedId) return linkedId === catalogModel.id
  if (!canUseModelTextFallback(catalogModel.name)) return false

  const haystacks = [listing.title, listing.model]
  const matchesThis = haystacks.some((text) => listingTitleMatchesModel(text ?? "", catalogModel.name))
  if (!matchesThis) return false

  for (const sibling of siblingModels) {
    if (sibling.id === catalogModel.id) continue
    if (sibling.name.trim().length <= catalogModel.name.trim().length) continue
    if (haystacks.some((text) => listingTitleMatchesModel(text ?? "", sibling.name))) {
      return false
    }
  }
  return true
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
