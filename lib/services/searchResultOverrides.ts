import { unstable_cache, revalidateTag } from "next/cache"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { listEnabledOverrideListingIdsForQuery } from "@/lib/db/searchCuration"
import { normalizeSearchCurationKey } from "@/lib/validations/searchCuration"

export const SEARCH_OVERRIDES_CACHE_TAG = "search-overrides"

/**
 * Pinned listing ids for a query (admin override). Used only when organic search
 * returns nothing, so the extra lookup stays off the hot path. Cached per query key.
 */
export async function resolveSearchOverrideListingIds(rawQuery: string): Promise<string[]> {
  const normalized = normalizeSearchCurationKey(rawQuery)
  if (!normalized) return []

  const loader = unstable_cache(
    async (): Promise<string[]> => {
      try {
        const service = createServiceRoleClient()
        return await listEnabledOverrideListingIdsForQuery(service, normalized)
      } catch (e) {
        console.error("[searchResultOverrides] load failed:", e)
        return []
      }
    },
    ["search-override-listing-ids-v1", normalized],
    { tags: [SEARCH_OVERRIDES_CACHE_TAG], revalidate: 300 },
  )

  return loader()
}

/** Call after any admin override write so search picks up the change. */
export function revalidateSearchOverrides(): void {
  revalidateTag(SEARCH_OVERRIDES_CACHE_TAG)
}
