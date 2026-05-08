import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchActiveSurfboardListingsByIdsOrdered } from "@/lib/db/recent-viewed-surfboards"
import {
  pdpRecentStripListingFromRow,
  type PdpRecentStripListingWithFavorite,
} from "@/lib/pdp-recent-strip-listing"

export async function fetchPdpRecentSurfboardListings(
  supabase: SupabaseClient,
  orderedIds: readonly string[],
  viewerUserId: string | null,
): Promise<PdpRecentStripListingWithFavorite[]> {
  const rows = await fetchActiveSurfboardListingsByIdsOrdered(supabase, orderedIds)
  if (rows.length === 0) return []

  let favorited = new Set<string>()
  if (viewerUserId) {
    const ids = rows.map((r) => String(r.id ?? "")).filter(Boolean)
    const { data } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", viewerUserId)
      .in("listing_id", ids)
    favorited = new Set((data ?? []).map((f) => f.listing_id))
  }

  return rows.map((r) => ({
    ...pdpRecentStripListingFromRow(r),
    viewerFavorited: favorited.has(String(r.id ?? "")),
  }))
}
