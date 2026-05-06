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

/** Either buyer/seller orientation (unique per ordered pair). RLS: visible when caller participates. */
export async function getAnyConversationBetweenUsers(
  supabase: SupabaseClient,
  userIdA: string,
  userIdB: string,
): Promise<{ id: string } | null> {
  const ab = await getConversationForBuyerSeller(supabase, userIdA, userIdB)
  if (ab) return { id: ab.id }
  const ba = await getConversationForBuyerSeller(supabase, userIdB, userIdA)
  if (ba) return { id: ba.id }
  return null
}

/** True if the user is the buyer or seller in this conversation (RLS-safe lookup). */
export async function userParticipatesInConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .maybeSingle()

  if (error || !data) return false
  return true
}

/** Creates buyer↔seller thread if missing. Caller must be authenticated as `buyerId` (insert RLS). */
export async function ensureConversationBetweenBuyerAndSeller(
  supabase: SupabaseClient,
  buyerId: string,
  sellerId: string,
): Promise<{ id: string } | null> {
  const existing = await getConversationForBuyerSeller(supabase, buyerId, sellerId)
  if (existing) {
    return { id: existing.id }
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      buyer_id: buyerId,
      seller_id: sellerId,
      listing_id: null,
    })
    .select("id")
    .single()

  if (error || !data?.id) {
    return null
  }
  return { id: data.id as string }
}
