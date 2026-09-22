import { unstable_cache } from "next/cache"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"
import {
  loadMarketplaceSearchPage,
  type MarketplaceSearchCategory,
  type MarketplaceSearchPagePayload,
} from "@/lib/services/marketplaceSearchPage"
import { marketplaceSearchCacheParts } from "@/lib/utils/marketplace-search-cache-key"
import { MARKETPLACE_SEARCH_CACHE_TAG } from "@/lib/cache/revalidate-marketplace-search"

export { MARKETPLACE_SEARCH_CACHE_TAG }

/** Same window as `/search/recent` ISR. */
export const MARKETPLACE_SEARCH_REVALIDATE_SECONDS = 60

const getCachedBrowseCategories = unstable_cache(
  async (): Promise<MarketplaceSearchCategory[]> => {
    const supabase = createServiceRoleClient()
    const { data } = await supabase
      .from("categories")
      .select("id, name, slug, board")
      .eq("board", true)
    return data ?? []
  },
  ["browse-categories"],
  { revalidate: 60 * 60 * 24, tags: ["browse-categories"] },
)

async function loadMarketplaceSearchPageUncached(
  rawQuery: string,
  brandSlug: string,
  categorySlug: string,
): Promise<MarketplaceSearchPagePayload> {
  const supabase = createAnonSupabaseClient()
  const categoryRows = await getCachedBrowseCategories()
  return loadMarketplaceSearchPage(supabase, rawQuery, brandSlug, categorySlug, categoryRows)
}

const getCachedMarketplaceSearchPage = unstable_cache(
  loadMarketplaceSearchPageUncached,
  ["marketplace-search-page-v1"],
  {
    revalidate: MARKETPLACE_SEARCH_REVALIDATE_SECONDS,
    tags: [MARKETPLACE_SEARCH_CACHE_TAG],
  },
)

/**
 * Cached public search results. Safe to share across viewers — no auth, no
 * favorites. Dev bypasses the Data Cache so query tweaks show immediately.
 */
export async function getMarketplaceSearchPageCached(
  rawQuery: string,
  brandSlugFromUrl: string,
  categorySlugFromUrl: string,
): Promise<MarketplaceSearchPagePayload> {
  const { rawQuery: q, brandSlug, categorySlug } = marketplaceSearchCacheParts(
    rawQuery,
    brandSlugFromUrl,
    categorySlugFromUrl,
  )
  if (process.env.NODE_ENV === "development") {
    return loadMarketplaceSearchPageUncached(q, brandSlug, categorySlug)
  }
  return getCachedMarketplaceSearchPage(q, brandSlug, categorySlug)
}
