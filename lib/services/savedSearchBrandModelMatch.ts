function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

function includesInsensitive(
  haystack: string | null | undefined,
  needle: string | undefined,
): boolean {
  const text = (needle ?? "").trim()
  if (!text) return true
  return norm(haystack).includes(text.toLowerCase())
}

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
 * Catalog ids win for the field they identify.
 * A typed brand or model still has to match when that side has no catalog id,
 * including a directory brand plus a freeform model.
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
    if ((listing.brand_id ?? "").trim() !== brandId) return false
  } else if (!includesInsensitive(listing.brand, criteria.brand)) {
    return false
  }

  const model = criteria.model?.trim() ?? ""
  if (!model) return true
  return includesInsensitive(listing.model, model) || includesInsensitive(listing.title, model)
}
