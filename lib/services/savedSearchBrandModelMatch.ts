import { savedSearchBrandTextsMatch, savedSearchTextMatches } from "@/lib/utils/saved-search-brand-text"

export type SavedSearchBrandModelListing = {
  brand?: string | null
  model?: string | null
  title?: string | null
  brand_id?: string | null
  brand_model_id?: string | null
}

export type SavedSearchBrandModelCriteria = {
  brand?: string
  brandId?: string
  model?: string
  brandModelId?: string
}

/**
 * Catalog ids win when the listing actually has that id.
 * A directory brand still matches an unlinked listing by normalized brand text.
 * A typed model still has to match when the search has no catalog model id.
 */
export function savedSearchBrandAndModelMatch(
  listing: SavedSearchBrandModelListing,
  criteria: SavedSearchBrandModelCriteria,
): boolean {
  const brandModelId = criteria.brandModelId?.trim() ?? ""
  if (brandModelId) {
    return (listing.brand_model_id ?? "").trim() === brandModelId
  }

  const brandId = criteria.brandId?.trim() ?? ""
  if (brandId) {
    const listingBrandId = (listing.brand_id ?? "").trim()
    if (listingBrandId) {
      if (listingBrandId !== brandId) return false
    } else if (!criteria.brand?.trim() || !savedSearchBrandTextsMatch(listing.brand, criteria.brand)) {
      return false
    }
  } else if (!savedSearchBrandTextsMatch(listing.brand, criteria.brand)) {
    return false
  }

  const model = criteria.model?.trim() ?? ""
  if (!model) return true
  return savedSearchTextMatches(listing.model, model) || savedSearchTextMatches(listing.title, model)
}
