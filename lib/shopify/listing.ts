export function isShopifyManagedListing(listing: {
  inventory_source?: string | null
}): boolean {
  return listing.inventory_source === "shopify"
}
