import type { SupabaseClient } from "@supabase/supabase-js"

export type ConversationRef = {
  id: string
  listing_id: string | null
}

/**
 * Resolves the marketplace thread between a buyer, seller, and listing.
 * Pass `listingId: null` for support / general threads (one per buyer+seller pair).
 */
export async function getConversationForBuyerSellerListing(
  supabase: SupabaseClient,
  buyerId: string,
  sellerId: string,
  listingId: string | null,
): Promise<ConversationRef | null> {
  let query = supabase
    .from("conversations")
    .select("id, listing_id")
    .eq("buyer_id", buyerId)
    .eq("seller_id", sellerId)

  if (listingId === null) {
    query = query.is("listing_id", null)
  } else {
    query = query.eq("listing_id", listingId)
  }

  const { data, error } = await query.maybeSingle()
  if (error || !data) return null
  return data
}

/** @deprecated Use getConversationForBuyerSellerListing with an explicit listing id. */
export async function getConversationForBuyerSeller(
  supabase: SupabaseClient,
  buyerId: string,
  sellerId: string,
  listingId?: string | null,
): Promise<ConversationRef | null> {
  if (listingId !== undefined) {
    return getConversationForBuyerSellerListing(supabase, buyerId, sellerId, listingId)
  }

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

/** Either buyer/seller orientation. Prefer listing-specific lookup when listingId is provided. */
export async function getAnyConversationBetweenUsers(
  supabase: SupabaseClient,
  userIdA: string,
  userIdB: string,
  listingId?: string | null,
): Promise<ConversationRef | null> {
  const ab = await getConversationForBuyerSeller(supabase, userIdA, userIdB, listingId)
  if (ab) return ab
  const ba = await getConversationForBuyerSeller(supabase, userIdB, userIdA, listingId)
  if (ba) return ba
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
  const existing = await getConversationForBuyerSellerListing(supabase, buyerId, sellerId, null)
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

/** Creates or returns the listing-scoped marketplace thread. */
export async function ensureConversationForBuyerSellerListing(
  supabase: SupabaseClient,
  buyerId: string,
  sellerId: string,
  listingId: string | null,
): Promise<{ id: string } | null> {
  const existing = await getConversationForBuyerSellerListing(supabase, buyerId, sellerId, listingId)
  if (existing) {
    return { id: existing.id }
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      buyer_id: buyerId,
      seller_id: sellerId,
      listing_id: listingId,
    })
    .select("id")
    .single()

  if (error || !data?.id) {
    const retry = await getConversationForBuyerSellerListing(supabase, buyerId, sellerId, listingId)
    if (retry) return { id: retry.id }
    return null
  }

  return { id: data.id as string }
}

/** All listing threads between the same buyer and seller (for hub / switcher UI). */
export async function listConversationsForBuyerSellerPair(
  supabase: SupabaseClient,
  buyerId: string,
  sellerId: string,
): Promise<ConversationRef[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, listing_id")
    .eq("buyer_id", buyerId)
    .eq("seller_id", sellerId)
    .order("last_message_at", { ascending: false })

  if (error || !data) return []
  return data as ConversationRef[]
}
