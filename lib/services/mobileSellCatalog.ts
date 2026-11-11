import { getSellBrandCatalogModelsCached } from "@/lib/cache/sell-brand-catalog-models"
import { listBrandProductCategoriesByBrandIds } from "@/lib/db/brand-product-categories"
import { searchBrandsCatalogSuggestWithClient } from "@/lib/services/brandDirectorySearch"
import { mapMobileSellBrandModels, mapMobileSellBrandSuggest } from "@/lib/services/mobileSellCatalogMap"
import type { MobileSellCatalogSearch } from "@reswell/api-contract"
import { APPAREL_SELL_ADMIN_ONLY } from "@/lib/apparel-listing-config"
import { getDb } from "@/lib/supabase/db"
import { SELL_CATALOG_SEARCH_CATEGORIES, type SellCatalogSearchCategory } from "@/lib/types/sell-catalog-search"

function searchableCategories(isAdmin: boolean): SellCatalogSearchCategory[] {
  return SELL_CATALOG_SEARCH_CATEGORIES.filter(
    (category) => category !== "apparel" || !APPAREL_SELL_ADMIN_ONLY || isAdmin,
  )
}

/**
 * Brand typeahead for the sell form. Same pipeline as the website
 * `searchBrandsCatalogSuggest` action — directory brands only, never models.
 */
export async function searchMobileSellCatalog(query: string): Promise<MobileSellCatalogSearch> {
  const supabase = getDb({ consistency: "eventual", purpose: "catalog" })
  const { rows } = await searchBrandsCatalogSuggestWithClient(supabase, query)
  const categoryByBrandId = await listBrandProductCategoriesByBrandIds(
    supabase,
    rows.map((row) => row.id),
  )
  return mapMobileSellBrandSuggest(rows, categoryByBrandId)
}

/** Same brand drill-in as `GET /api/sell/catalog-search/brand-models`, shaped for the app. */
export async function listMobileSellBrandModels(
  brandId: string,
  isAdmin: boolean,
): Promise<MobileSellCatalogSearch> {
  const rows = await getSellBrandCatalogModelsCached(brandId, searchableCategories(isAdmin))
  return mapMobileSellBrandModels(rows)
}
