import { unstable_cache } from "next/cache"
import { searchSellCatalogForSell } from "@/lib/services/sellCatalogSearch"
import {
  isSellCatalogSearchCategory,
  type SellCatalogSearchCategory,
  type SellCatalogSearchResult,
} from "@/lib/types/sell-catalog-search"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"

/** `/sell` cross-category catalog search — keyed by normalized query + category scope. */
export const SELL_CATALOG_SEARCH_CACHE_TAG = "sell-catalog-search"
export const SELL_CATALOG_SEARCH_REVALIDATE_SECONDS = 60 * 60

function normalizeSellCatalogSearchQuery(qRaw: string): string {
  return qRaw.trim().replace(/%/g, "").toLowerCase()
}

async function loadSellCatalogSearch(
  qNormalized: string,
  categoriesKey: string,
): Promise<SellCatalogSearchResult> {
  const supabase = createAnonSupabaseClient()
  const categories = categoriesKey
    .split(",")
    .filter(isSellCatalogSearchCategory)
  return searchSellCatalogForSell(supabase, qNormalized, { categories })
}

const getCachedSellCatalogSearch = unstable_cache(
  loadSellCatalogSearch,
  ["sell-catalog-search-v2"],
  {
    revalidate: SELL_CATALOG_SEARCH_REVALIDATE_SECONDS,
    tags: [SELL_CATALOG_SEARCH_CACHE_TAG],
  },
)

export async function getSellCatalogSearchCached(
  qRaw: string,
  categories: readonly SellCatalogSearchCategory[],
): Promise<SellCatalogSearchResult> {
  const q = normalizeSellCatalogSearchQuery(qRaw)
  if (q.length < 1 || categories.length === 0) {
    return {
      results: [],
      similarResults: [],
      meta: { backend: "supabase", matchTier: "none" },
    }
  }
  return getCachedSellCatalogSearch(q, [...categories].sort().join(","))
}
