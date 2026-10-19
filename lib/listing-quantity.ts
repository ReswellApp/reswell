/** Peer listings sell one unit at a time unless condition is brand new. */
export const BRAND_NEW_LISTING_CONDITION = "brand_new"

/** PDP copy switches to a remaining-count once stock is this low. */
export const LISTING_LIMITED_QUANTITY_AT = 5

export function isBrandNewListingCondition(condition: string | null | undefined): boolean {
  return condition === BRAND_NEW_LISTING_CONDITION
}

/**
 * Units stored on `listings.quantity`.
 * Used and unknown conditions are always a single item. Brand new accepts any whole number >= 1.
 */
export function listingQuantityForCondition(
  condition: string | null | undefined,
  quantity: unknown,
): number {
  if (!isBrandNewListingCondition(condition)) return 1
  const n = typeof quantity === "number" ? quantity : Number(quantity)
  if (!Number.isFinite(n)) return 1
  const whole = Math.floor(n)
  return whole >= 1 ? whole : 1
}

export type ListingScarcityCopy = {
  title: string
  detail: string
}

/**
 * Buyer-facing scarcity on `/l`.
 * Brand new at 5 or fewer: "Limited quantity only" and how many are left.
 * Brand new above that: no scarcity line.
 * Every other condition: one physical item.
 */
export function listingScarcityCopy(
  condition: string | null | undefined,
  quantity: unknown,
): ListingScarcityCopy | null {
  if (isBrandNewListingCondition(condition)) {
    const qty = listingQuantityForCondition(condition, quantity)
    if (qty > LISTING_LIMITED_QUANTITY_AT) return null
    return {
      title: "Limited quantity only",
      detail: `${qty} left`,
    }
  }
  return {
    title: "Only one available",
    detail: "— grab it before it's gone",
  }
}

/** True when this sale takes the last unit, or the listing is not multi-quantity brand new. */
export function listingUnitSaleEndsListing(
  listing: { condition?: string | null; quantity?: number | null },
  unitsSold = 1,
): boolean {
  const remaining = peerBrandNewUnitsRemaining(listing)
  if (remaining == null) return true
  const sold = Math.max(1, Math.floor(unitsSold))
  return remaining - sold <= 0
}

/** Null when the column is absent. 0 means the brand-new listing cannot be bought. */
export function peerBrandNewUnitsRemaining(listing: {
  condition?: string | null
  quantity?: number | null
}): number | null {
  if (!isBrandNewListingCondition(listing.condition)) return null
  if (listing.quantity == null) return null
  const n = Math.floor(Number(listing.quantity))
  if (!Number.isFinite(n)) return null
  return Math.max(0, n)
}
