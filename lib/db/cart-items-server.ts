import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Removes purchased listings from the buyer's saved cart after a successful checkout (service role).
 */
export async function deleteBuyerCartRowsForListings(
  serviceSupabase: SupabaseClient,
  buyerId: string,
  listingIds: string[],
): Promise<void> {
  if (!listingIds.length) return
  const ids = [...new Set(listingIds.map((id) => id.trim()).filter(Boolean))]
  if (!ids.length) return

  await serviceSupabase.from("cart_items").delete().eq("profile_id", buyerId.trim()).in("listing_id", ids)
}
