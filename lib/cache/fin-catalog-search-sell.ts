import { unstable_cache } from "next/cache"
import { searchFinCatalogForSell } from "@/lib/services/finCatalogSearch"
import type { FinCatalogSearchResult } from "@/lib/types/fin-catalog-search"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"
import { getFinCatalogBrandIdsCached } from "@/lib/cache/fin-catalog-brand-ids"

/** `/sell/fins` catalog search — keyed by normalized query. */
export const FIN_CATALOG_SEARCH_SELL_CACHE_TAG = "fin-catalog-search-sell"
export const FIN_CATALOG_SEARCH_SELL_REVALIDATE_SECONDS = 60 * 60

function normalizeFinCatalogSearchQuery(qRaw: string): string {
  return qRaw.trim().replace(/%/g, "").toLowerCase()
}

async function loadFinCatalogSearchSell(qNormalized: string): Promise<FinCatalogSearchResult> {
  const supabase = createAnonSupabaseClient()
  const finBrandIds = await getFinCatalogBrandIdsCached()
  return searchFinCatalogForSell(supabase, qNormalized, { finBrandIds })
}

const getCachedFinCatalogSearchSell = unstable_cache(
  loadFinCatalogSearchSell,
  ["fin-catalog-search-sell-v2"],
  {
    revalidate: FIN_CATALOG_SEARCH_SELL_REVALIDATE_SECONDS,
    tags: [FIN_CATALOG_SEARCH_SELL_CACHE_TAG],
  },
)

export async function getFinCatalogSearchSellCached(qRaw: string): Promise<FinCatalogSearchResult> {
  const q = normalizeFinCatalogSearchQuery(qRaw)
  if (q.length < 1) {
    return {
      brands: [],
      models: [],
      variants: [],
      results: [],
      similarResults: [],
      meta: { backend: "supabase", finBrandCount: 0, matchTier: "none" },
    }
  }
  return getCachedFinCatalogSearchSell(q)
}
