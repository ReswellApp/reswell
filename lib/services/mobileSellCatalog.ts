import { getSellCatalogSearchCached } from "@/lib/cache/sell-catalog-search"
import { mapMobileSellCatalog } from "@/lib/services/mobileSellCatalogMap"
import type { MobileSellCatalogSearch } from "@reswell/api-contract"
import { APPAREL_SELL_ADMIN_ONLY } from "@/lib/apparel-listing-config"
import { SELL_CATALOG_SEARCH_CATEGORIES, type SellCatalogSearchCategory } from "@/lib/types/sell-catalog-search"

function searchableCategories(isAdmin: boolean): SellCatalogSearchCategory[] {
  return SELL_CATALOG_SEARCH_CATEGORIES.filter(
    (category) => category !== "apparel" || !APPAREL_SELL_ADMIN_ONLY || isAdmin,
  )
}

/** Same catalog index as `GET /api/sell/catalog-search`, shaped for the app. */
export async function searchMobileSellCatalog(query: string, isAdmin: boolean): Promise<MobileSellCatalogSearch> {
  const result = await getSellCatalogSearchCached(query, searchableCategories(isAdmin))
  return mapMobileSellCatalog(result)
}
