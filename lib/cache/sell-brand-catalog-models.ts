import { unstable_cache } from "next/cache"
import { listSellCatalogModelRowsByBrandId } from "@/lib/db/sell-catalog-search"
import type {
  SellCatalogSearchCategory,
  SellCatalogSearchModelRow,
} from "@/lib/types/sell-catalog-search"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"

/** `/sell` trending-brand drill-in — one brand's catalog models, keyed by brand + categories. */
export const SELL_BRAND_CATALOG_MODELS_CACHE_TAG = "sell-brand-catalog-models"
const SELL_BRAND_CATALOG_MODELS_REVALIDATE_SECONDS = 60 * 10

async function loadSellBrandCatalogModels(
  brandId: string,
  categories: SellCatalogSearchCategory[],
): Promise<SellCatalogSearchModelRow[]> {
  const supabase = createAnonSupabaseClient()
  return listSellCatalogModelRowsByBrandId(supabase, brandId, categories)
}

export const getSellBrandCatalogModelsCached = unstable_cache(
  loadSellBrandCatalogModels,
  ["sell-brand-catalog-models-v1"],
  {
    revalidate: SELL_BRAND_CATALOG_MODELS_REVALIDATE_SECONDS,
    tags: [SELL_BRAND_CATALOG_MODELS_CACHE_TAG],
  },
)
