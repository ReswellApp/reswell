import type { SupabaseClient } from "@supabase/supabase-js"
import { HOME_PEER_LISTING_WITH_PROFILE_SELECT } from "@/lib/db/home-peer-listing-feed"

/** Matches `/sold` listing filters for surfboards (see `app/sold/page.tsx`). */
export const HOME_RECENTLY_SOLD_STRIP_LIMIT = 12

export async function fetchHomeRecentlySoldSurfboardRows(
  supabase: SupabaseClient,
): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(HOME_PEER_LISTING_WITH_PROFILE_SELECT)
    .eq("status", "sold")
    .eq("hidden_from_site", false)
    .eq("section", "surfboards")
    .order("updated_at", { ascending: false })
    .limit(HOME_RECENTLY_SOLD_STRIP_LIMIT)

  if (error) {
    console.error("fetchHomeRecentlySoldSurfboardRows:", error.message)
    return []
  }

  return data ?? []
}
