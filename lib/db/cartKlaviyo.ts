import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Profile IDs (Supabase auth user ids) with this listing in their cart.
 * Uses service role — sellers cannot read other buyers' cart rows via RLS.
 */
export async function fetchCartProfileIdsForListing(
  supabase: SupabaseClient,
  listingId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("cart_items")
    .select("profile_id")
    .eq("listing_id", listingId)

  if (error) return []

  const ids = new Set<string>()
  for (const row of data ?? []) {
    const id = typeof row.profile_id === "string" ? row.profile_id.trim() : ""
    if (id) ids.add(id)
  }
  return [...ids]
}
