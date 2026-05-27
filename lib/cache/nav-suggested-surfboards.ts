import { unstable_cache } from "next/cache"
import { fetchNavSuggestedSurfboardPool } from "@/lib/db/nav-suggested-surfboards"
import type {
  NavSuggestedSurfboardPoolRow,
  NavSuggestedSurfboardsMode,
} from "@/lib/types/nav-suggested-surfboards"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"

/** Nav search idle dropdown — popular / newest surfboard pools. */
export const NAV_SUGGESTED_SURFBOARDS_CACHE_TAG = "nav-suggested-surfboards"
export const NAV_SUGGESTED_SURFBOARDS_REVALIDATE_SECONDS = 60 * 60 * 6

async function loadNavSuggestedSurfboardPool(
  mode: NavSuggestedSurfboardsMode,
): Promise<NavSuggestedSurfboardPoolRow[]> {
  const supabase = createAnonSupabaseClient()
  return fetchNavSuggestedSurfboardPool(supabase, mode)
}

const getCachedPopularNavSuggestedSurfboardPool = unstable_cache(
  () => loadNavSuggestedSurfboardPool("popular"),
  ["nav-suggested-surfboards", "popular"],
  {
    revalidate: NAV_SUGGESTED_SURFBOARDS_REVALIDATE_SECONDS,
    tags: [NAV_SUGGESTED_SURFBOARDS_CACHE_TAG],
  },
)

const getCachedNewestNavSuggestedSurfboardPool = unstable_cache(
  () => loadNavSuggestedSurfboardPool("newest"),
  ["nav-suggested-surfboards", "newest"],
  {
    revalidate: NAV_SUGGESTED_SURFBOARDS_REVALIDATE_SECONDS,
    tags: [NAV_SUGGESTED_SURFBOARDS_CACHE_TAG],
  },
)

export async function getNavSuggestedSurfboardPoolCached(
  mode: NavSuggestedSurfboardsMode,
): Promise<NavSuggestedSurfboardPoolRow[]> {
  return mode === "popular"
    ? getCachedPopularNavSuggestedSurfboardPool()
    : getCachedNewestNavSuggestedSurfboardPool()
}
