import type { SupabaseClient } from "@supabase/supabase-js"

/** Distinct users who saved this listing (one row per user per listing). */
export async function getListingFavoriteCount(
  supabase: SupabaseClient,
  listingId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("count_listing_favorites", {
    p_listing_id: listingId,
  })
  if (error) {
    console.error("count_listing_favorites:", error.message)
    return 0
  }
  if (data == null) return 0
  return typeof data === "number" ? data : Number(data) || 0
}
