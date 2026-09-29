/** Absolute listing price bounds shared by peer sell flows. */
export const LISTING_PRICE_ABS_MIN_USD = 0.01
export const LISTING_PRICE_MAX_USD = 999_999.99

/** Live surfboard listings, price-drop floors, and negotiated sales cannot go below this. */
export const SURFBOARD_MIN_SALE_PRICE_USD = 50

export const SURFBOARD_MIN_PRICE_MESSAGE = "Surfboard price must be at least $50."

export const SURFBOARD_OFFER_MIN_MESSAGE = "Offers on surfboards must be at least $50."

export const SURFBOARD_PRICE_DROP_FLOOR_MESSAGE =
  "Lowest-after-drop price must be at least $50."

export function isSurfboardListingSection(section: string | null | undefined): boolean {
  return section === "surfboards"
}

export function surfboardMinPriceError(price: number): string | null {
  if (!Number.isFinite(price) || price < SURFBOARD_MIN_SALE_PRICE_USD) {
    return SURFBOARD_MIN_PRICE_MESSAGE
  }
  if (price > LISTING_PRICE_MAX_USD) {
    return `Enter a valid price up to $${LISTING_PRICE_MAX_USD.toLocaleString()}.`
  }
  return null
}

export function surfboardPriceDropFloorError(floor: number, listPrice?: number): string | null {
  if (!Number.isFinite(floor) || floor < SURFBOARD_MIN_SALE_PRICE_USD) {
    return SURFBOARD_PRICE_DROP_FLOOR_MESSAGE
  }
  if (floor > LISTING_PRICE_MAX_USD) {
    return `Lowest-after-drop price must be at most $${LISTING_PRICE_MAX_USD.toLocaleString()}.`
  }
  if (listPrice != null && Number.isFinite(listPrice) && floor >= listPrice) {
    return "Lowest-after-drop price must be less than your current list price."
  }
  return null
}

/**
 * Reject a surfboard list price or drop floor on a listing that is going live
 * or already live. Drafts may stay incomplete.
 */
export function liveSurfboardPriceWriteError(input: {
  section: string | null | undefined
  status: string | null | undefined
  price: number | null | undefined
  autoPriceDropFloor?: number | null
}): string | null {
  if (!isSurfboardListingSection(input.section)) return null
  if (input.status === "draft") return null
  if (input.price == null || !Number.isFinite(input.price)) return SURFBOARD_MIN_PRICE_MESSAGE
  const priceError = surfboardMinPriceError(input.price)
  if (priceError) return priceError
  if (input.autoPriceDropFloor != null) {
    return surfboardPriceDropFloorError(input.autoPriceDropFloor, input.price)
  }
  return null
}

/** Negotiated surfboard sale price. Other sections are unchanged. */
export function surfboardOfferAmountError(
  amount: number,
  section: string | null | undefined,
): string | null {
  if (!isSurfboardListingSection(section)) return null
  if (!Number.isFinite(amount) || amount < SURFBOARD_MIN_SALE_PRICE_USD) {
    return SURFBOARD_OFFER_MIN_MESSAGE
  }
  return null
}
