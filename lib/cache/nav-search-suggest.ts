import { unstable_cache } from "next/cache"
import type { SearchSuggestResult } from "@/lib/types/marketplace-search-suggest"
import {
  normalizeMarketplaceSearchSuggestQuery,
  normalizeMarketplaceSearchSuggestSection,
  runMarketplaceSearchSuggest,
} from "@/lib/services/marketplaceSearchSuggest"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"

/** Header nav typeahead (Top listings, brands, categories). */
export const NAV_SEARCH_SUGGEST_CACHE_TAG = "nav-search-suggest"
export const NAV_SEARCH_SUGGEST_REVALIDATE_SECONDS = 60 * 60

async function loadNavSearchSuggest(
  qNormalized: string,
  sectionNormalized: "new" | "surfboards",
): Promise<SearchSuggestResult> {
  const supabase = createAnonSupabaseClient()
  return runMarketplaceSearchSuggest(supabase, qNormalized, sectionNormalized)
}

const getCachedNavSearchSuggest = unstable_cache(
  loadNavSearchSuggest,
  ["nav-search-suggest"],
  {
    revalidate: NAV_SEARCH_SUGGEST_REVALIDATE_SECONDS,
    tags: [NAV_SEARCH_SUGGEST_CACHE_TAG],
  },
)

export async function getNavSearchSuggestCached(
  qRaw: string,
  section: string,
): Promise<SearchSuggestResult> {
  const q = normalizeMarketplaceSearchSuggestQuery(qRaw)
  if (!q || q.length < 2) {
    return {
      titles: [],
      categories: [],
      brands: [],
      listings: [],
      meta: { listingsBackend: "supabase" },
    }
  }
  const sectionNormalized = normalizeMarketplaceSearchSuggestSection(section)
  return getCachedNavSearchSuggest(q.toLowerCase(), sectionNormalized)
}
