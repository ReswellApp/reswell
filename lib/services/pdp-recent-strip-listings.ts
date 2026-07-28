import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listUserRecentlyViewedListingIds,
  PDP_RECENTLY_VIEWED_DISPLAY_LIMIT,
} from "@/lib/db/navSearchPersonalization"
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

/**
 * Signed-in PDP “Recently viewed”: DB history → active surfboards only, newest first.
 */
export async function fetchSignedInPdpRecentlyViewedSurfboards(
  supabase: SupabaseClient,
  viewerUserId: string,
  currentListingId: string,
  limit = PDP_RECENTLY_VIEWED_DISPLAY_LIMIT,
): Promise<PdpRecentStripListingWithFavorite[]> {
  // Fetch extra IDs so inactive / non-surfboard rows can drop out and still fill the strip.
  const recentIds = await listUserRecentlyViewedListingIds(
    supabase,
    viewerUserId,
    Math.max(limit * 4, 24),
  )
  const orderedIds = recentIds.filter((id) => id !== currentListingId)
  if (orderedIds.length === 0) return []

  const listings = await fetchPdpRecentSurfboardListings(
    supabase,
    orderedIds,
    viewerUserId,
  )
  return listings.slice(0, limit)
}
