import type { ListingPublicVisibilityFields } from "@/lib/listing-public-visibility"
import { isListingPubliclyVisible } from "@/lib/listing-public-visibility"

export type ListingInventoryFields = ListingPublicVisibilityFields & {
  sync_managed?: boolean | null
  stock_quantity?: number | null
}

/** True when quantity is tracked (Shopify sync and future multi-qty retail). */
export function listingTracksInventory(
  listing: Pick<ListingInventoryFields, "sync_managed">,
): boolean {
  return listing.sync_managed === true
}

export function listingStockQuantity(
  listing: Pick<ListingInventoryFields, "stock_quantity">,
): number {
  return Math.max(0, Number(listing.stock_quantity) || 0)
}

/** Whether the listing has units left for purchase. */
export function listingHasStock(listing: ListingInventoryFields): boolean {
  if (!listingTracksInventory(listing)) {
    return listing.status !== "sold"
  }
  return listingStockQuantity(listing) > 0
}

/** Buyer can complete checkout — extends public visibility with inventory rules. */
export function isListingInStockForPurchase(listing: ListingInventoryFields): boolean {
  if (!isListingPubliclyVisible(listing)) return false
  if (!listingTracksInventory(listing)) return true
  return listingStockQuantity(listing) > 0
}

export function peerListingCanPurchase(
  listing: ListingInventoryFields & {
    local_pickup?: boolean | null
    shipping_available?: boolean | null
  },
  opts: { isOwnListing: boolean },
): boolean {
  if (opts.isOwnListing) return false
  if (!isListingInStockForPurchase(listing)) return false
  const lp = listing.local_pickup !== false
  const sa = !!listing.shipping_available
  return lp || sa
}

/** Human-readable stock line for product detail pages. */
export function listingStockAvailabilityLabel(
  listing: Pick<ListingInventoryFields, "sync_managed" | "stock_quantity" | "status">,
): string | null {
  if (!listingTracksInventory(listing)) {
    return "Only one available"
  }
  const qty = listingStockQuantity(listing)
  if (qty <= 0) return "Out of stock"
  if (qty > 10) return "In stock"
  if (qty === 1) return "Only 1 left"
  return `${qty} in stock`
}

export type ListingStockBadgeVariant = "in_stock" | "low_stock" | "out_of_stock" | "hidden"

export function listingStockBadgeVariant(
  listing: Pick<ListingInventoryFields, "sync_managed" | "stock_quantity">,
): ListingStockBadgeVariant {
  if (!listingTracksInventory(listing)) return "hidden"
  const qty = listingStockQuantity(listing)
  if (qty <= 0) return "out_of_stock"
  if (qty <= 10) return "low_stock"
  return "in_stock"
}

/** Normalize a listings row for inventory / purchase helpers. */
export function listingInventoryFieldsFromRow(row: Record<string, unknown>): ListingInventoryFields & {
  local_pickup?: boolean | null
  shipping_available?: boolean | null
} {
  return {
    status: String(row.status ?? ""),
    title: (row.title as string | null | undefined) ?? null,
    hidden_from_site: (row.hidden_from_site as boolean | null | undefined) ?? null,
    archived_at: (row.archived_at as string | null | undefined) ?? null,
    sync_managed: (row.sync_managed as boolean | null | undefined) ?? null,
    stock_quantity: (row.stock_quantity as number | null | undefined) ?? null,
    local_pickup: (row.local_pickup as boolean | null | undefined) ?? null,
    shipping_available: (row.shipping_available as boolean | null | undefined) ?? null,
  }
}
