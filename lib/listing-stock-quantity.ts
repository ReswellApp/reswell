import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { isReswellShopListing } from "@/lib/reswell-shop"
import { isShopifyManagedListing } from "@/lib/shopify/listing"

/** Identical brand-new units a peer seller can put on one listing. */
export const BRAND_NEW_LISTING_QUANTITY_MIN = 1
export const BRAND_NEW_LISTING_QUANTITY_MAX = 999

export type ListingQuantitySource = {
  section?: string | null
  condition?: string | null
  stock_quantity?: number | null
  inventory_source?: string | null
}

export function isBrandNewListingCondition(condition: string | null | undefined): boolean {
  const value = (condition ?? "").trim()
  return value === "brand_new" || value === "new"
}

/** Integer in range, or null when the sell form value is not a valid quantity. */
export function parseBrandNewListingQuantity(raw: unknown): number | null {
  if (typeof raw === "number") {
    if (!Number.isInteger(raw)) return null
    if (raw < BRAND_NEW_LISTING_QUANTITY_MIN || raw > BRAND_NEW_LISTING_QUANTITY_MAX) return null
    return raw
  }
  const text = String(raw ?? "").trim()
  if (!/^\d+$/.test(text)) return null
  const parsed = Number(text)
  if (parsed < BRAND_NEW_LISTING_QUANTITY_MIN || parsed > BRAND_NEW_LISTING_QUANTITY_MAX) return null
  return parsed
}

/**
 * Units stored on `listings.stock_quantity`.
 * Brand-new listings keep the seller's quantity. Every other condition stays at 0
 * so checkout still treats the row as one unique item.
 */
export function stockQuantityForSellCondition(
  condition: string | null | undefined,
  quantity: unknown,
): number {
  if (!isBrandNewListingCondition(condition)) return 0
  return parseBrandNewListingQuantity(quantity) ?? BRAND_NEW_LISTING_QUANTITY_MIN
}

/** Prefill the sell-form quantity from a saved listing. Missing stock means one unit. */
export function sellFormStockQuantityValue(stock: unknown): string {
  const parsed = Math.floor(Number(stock) || 0)
  if (parsed >= BRAND_NEW_LISTING_QUANTITY_MIN) {
    return String(Math.min(BRAND_NEW_LISTING_QUANTITY_MAX, parsed))
  }
  return String(BRAND_NEW_LISTING_QUANTITY_MIN)
}

export function brandNewQuantityValidationMessage(
  condition: string | null | undefined,
  quantity: unknown,
): string | null {
  if (!isBrandNewListingCondition(condition)) return null
  if (parseBrandNewListingQuantity(quantity) == null) {
    return `Enter a quantity between ${BRAND_NEW_LISTING_QUANTITY_MIN} and ${BRAND_NEW_LISTING_QUANTITY_MAX}.`
  }
  return null
}

/**
 * Peer brand-new inventory that buyers can purchase in quantity.
 * Legacy brand-new rows (stock 0) and used listings stay single-unit.
 */
export function peerBrandNewStockQuantity(listing: ListingQuantitySource): number {
  if (!isPeerListingSection(listing.section)) return 0
  if (isShopifyManagedListing(listing)) return 0
  if (!isBrandNewListingCondition(listing.condition)) return 0
  const stock = Math.floor(Number(listing.stock_quantity) || 0)
  return stock >= BRAND_NEW_LISTING_QUANTITY_MIN ? stock : 0
}

/** Max units one buyer can put in the cart for this listing. */
export function listingBuyerQuantityCap(listing: ListingQuantitySource): number {
  if (isShopifyManagedListing(listing)) return 1
  if (isReswellShopListing(listing.section)) {
    return Math.max(0, Math.floor(Number(listing.stock_quantity) || 0))
  }
  const peerStock = peerBrandNewStockQuantity(listing)
  if (peerStock >= BRAND_NEW_LISTING_QUANTITY_MIN) return peerStock
  return 1
}

export function listingSupportsBuyerQuantity(listing: ListingQuantitySource): boolean {
  if (isShopifyManagedListing(listing)) return false
  if (isReswellShopListing(listing.section)) return listingBuyerQuantityCap(listing) >= 1
  return peerBrandNewStockQuantity(listing) > 1
}

export function clampListingBuyerQuantity(listing: ListingQuantitySource, requested: unknown): number {
  const cap = listingBuyerQuantityCap(listing)
  const qty = Math.max(1, Math.floor(Number(requested) || 1))
  if (cap < 1) return 1
  return Math.min(qty, Math.max(1, cap))
}
