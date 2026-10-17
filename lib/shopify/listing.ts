export function isShopifyManagedListing(listing: {
  inventory_source?: string | null
}): boolean {
  return listing.inventory_source === "shopify"
}

/** Shown when a seller tries to permanently delete a Shopify-synced listing. */
export const SHOPIFY_LISTING_DELETE_BLOCKED_MESSAGE =
  "This listing is synced from Shopify. Unpublish it from the Shopify page in your dashboard."
