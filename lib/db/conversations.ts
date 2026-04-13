import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Resolves the single marketplace thread between a buyer and seller.
 * Listing context is stored on the row but does not create additional threads.
 */
export async function getConversationForBuyerSeller(
  supabase: SupabaseClient,
  buyerId: string,
  sellerId: string,
): Promise<{ id: string; listing_id: string | null } | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, listing_id")
    .eq("buyer_id", buyerId)
    .eq("seller_id", sellerId)
    .order("last_message_at", { ascending: false })
    .limit(1)

  if (error || !data?.[0]) return null
  return data[0]
}
