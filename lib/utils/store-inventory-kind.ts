/** How a board in a consignment store's floor inventory is owned. */
export type StoreInventoryKind = "consignment" | "shop_owned"

export function resolveStoreInventoryKind(
  consignorProfileId: string | null | undefined,
): StoreInventoryKind {
  return consignorProfileId ? "consignment" : "shop_owned"
}

export function isShopOwnedStoreListing(listing: {
  consignment_store_id?: string | null
  consignor_profile_id?: string | null
}): boolean {
  return Boolean(listing.consignment_store_id) && !listing.consignor_profile_id
}
