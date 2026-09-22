type DirectoryShopSearchFields = {
  shop_name: string | null
  shop_description: string | null
  display_name: string | null
  city: string | null
  shop_address: string | null
}

type DirectoryCatalogItem = {
  shop: DirectoryShopSearchFields
  inventoryCount: number
}

export function sellerMatchesDirectoryQuery(shop: DirectoryShopSearchFields, term: string): boolean {
  const haystack = [
    shop.shop_name,
    shop.shop_description,
    shop.display_name,
    shop.city,
    shop.shop_address,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase()

  return haystack.includes(term)
}

export function filterSellersDirectoryCatalog<T extends DirectoryCatalogItem>(
  catalog: { items: T[]; totalInventory: number },
  q: string | undefined,
): { items: T[]; totalInventory: number } {
  const term = (q ?? "").trim().toLowerCase()
  if (!term) return catalog

  const items = catalog.items.filter(({ shop }) => sellerMatchesDirectoryQuery(shop, term))
  const totalInventory = items.reduce((sum, item) => sum + item.inventoryCount, 0)
  return { items, totalInventory }
}
