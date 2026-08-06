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

/**
 * Sentinel so empty results are never persisted: a transient backend failure
 * (ES timeout, network blip) would otherwise pin "no matches" for a real
 * catalog query for the full revalidate window. `unstable_cache` does not
 * cache thrown errors, so empties are recomputed on every request instead.
 */
class EmptySellCatalogSearchResult extends Error {
  constructor(readonly result: SellCatalogSearchResult) {
    super("empty sell catalog search result")
  }
}

const getCachedSellCatalogSearch = unstable_cache(
  async (qNormalized: string, categoriesKey: string): Promise<SellCatalogSearchResult> => {
    const result = await loadSellCatalogSearch(qNormalized, categoriesKey)
    if (result.results.length === 0 && result.similarResults.length === 0) {
      throw new EmptySellCatalogSearchResult(result)
    }
    return result
  },
  ["sell-catalog-search-v3"],
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
  try {
    return await getCachedSellCatalogSearch(q, [...categories].sort().join(","))
  } catch (error) {
    if (error instanceof EmptySellCatalogSearchResult) return error.result
    throw error
  }
}
