import { unstable_cache } from "next/cache"
import type { AdminNavBadgeCounts } from "@/lib/admin-nav-badge-counts"
import { fetchAdminNavBadgeCounts } from "@/lib/db/adminNavCounts"
import { getDb } from "@/lib/supabase/db"
import type { SupabaseClient } from "@supabase/supabase-js"

export const ADMIN_NAV_BADGE_COUNTS_CACHE_TAG = "admin-nav-badge-counts"
/** Short TTL: badges can lag a bit; they must not run 10 COUNT(*)s on every admin click. */
export const ADMIN_NAV_BADGE_COUNTS_REVALIDATE_SECONDS = 45

async function loadAdminNavBadgeCounts(
  includeBrandRequests: boolean,
): Promise<AdminNavBadgeCounts> {
  const supabase = getDb({ consistency: "eventual", purpose: "analytics" })
  return fetchAdminNavBadgeCounts(supabase, { includeBrandRequests })
}

const getCachedAdminNavBadgeCountsByRole = unstable_cache(
  loadAdminNavBadgeCounts,
  ["admin-nav-badge-counts"],
  {
    revalidate: ADMIN_NAV_BADGE_COUNTS_REVALIDATE_SECONDS,
    tags: [ADMIN_NAV_BADGE_COUNTS_CACHE_TAG],
  },
)

export async function getCachedAdminNavBadgeCounts(
  supabase: SupabaseClient,
  options: { includeBrandRequests: boolean },
): Promise<AdminNavBadgeCounts> {
  try {
    return await getCachedAdminNavBadgeCountsByRole(options.includeBrandRequests)
  } catch (error) {
    console.error("[admin nav badge counts] cache load failed, using request client", error)
    return fetchAdminNavBadgeCounts(supabase, options)
  }
}
