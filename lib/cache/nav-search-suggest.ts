import { unstable_cache } from "next/cache"
import type { SearchSuggestResult } from "@/lib/types/marketplace-search-suggest"
import type { NavSearchSuggestSectionKey } from "@/lib/header-nav-marketplace-search"
import { navSearchSuggestSectionKey } from "@/lib/header-nav-marketplace-search"
import {
  normalizeMarketplaceSearchSuggestQuery,
  runMarketplaceSearchSuggest,
} from "@/lib/services/marketplaceSearchSuggest"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"

/** Header nav typeahead (Top listings, brands, categories). */
export const NAV_SEARCH_SUGGEST_CACHE_TAG = "nav-search-suggest"
/** Short TTL: typeahead should pick up new listings without hammering ES/DB per keystroke. */
export const NAV_SEARCH_SUGGEST_REVALIDATE_SECONDS = 60 * 10

async function loadNavSearchSuggest(
  qNormalized: string,
  sectionNormalized: NavSearchSuggestSectionKey,
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
  const sectionNormalized = navSearchSuggestSectionKey(section)
  // Bypass Data Cache in development so typeahead changes are testable immediately.
  if (process.env.NODE_ENV === "development") {
    return loadNavSearchSuggest(q.toLowerCase(), sectionNormalized)
  }
  return getCachedNavSearchSuggest(q.toLowerCase(), sectionNormalized)
}
