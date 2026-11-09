import type { SupabaseClient } from "@supabase/supabase-js"
import type { HomePeerScrollListing } from "@/components/features/home/home-peer-listing-scroll-tile"
import {
  HOME_PEER_LISTING_WITH_PROFILE_SELECT,
  hydrateHomePeerListingRows,
  projectHomePeerCardListing,
} from "@/lib/db/home-peer-listing-feed"

export const PDP_SELLER_LISTING_LIMIT = 12

/**
 * Other active listings from the same seller in the same section, newest first.
 * Shared by `/l` and `GET /api/mobile/v1/listings/:id/rails`.
 */
export async function fetchMoreFromSellerListings(
  supabase: SupabaseClient,
  opts: {
    sellerId: string
    section: string
    excludeListingId: string
    limit?: number
  },
): Promise<HomePeerScrollListing[]> {
  const limit = Math.min(Math.max(opts.limit ?? PDP_SELLER_LISTING_LIMIT, 1), 24)
  const { data, error } = await supabase
    .from("listings")
    .select(HOME_PEER_LISTING_WITH_PROFILE_SELECT)
    .eq("user_id", opts.sellerId)
    .eq("status", "active")
    .eq("section", opts.section)
    .eq("hidden_from_site", false)
    .neq("id", opts.excludeListingId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return hydrateHomePeerListingRows(data as Record<string, unknown>[]).map((row) =>
    projectHomePeerCardListing(row),
  )
}
