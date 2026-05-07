import type { SupabaseClient } from "@supabase/supabase-js"

/** Buyers with this listing saved in cart (surfboards only; excludes ineligible listing states). */
export async function getListingCartHolderCount(
  supabase: SupabaseClient,
  listingId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("count_listing_cart_holders", {
    p_listing_id: listingId,
  })
  if (error) {
    console.error("count_listing_cart_holders:", error.message)
    return 0
  }
  if (data == null) return 0
  return typeof data === "number" ? data : Number(data) || 0
}
