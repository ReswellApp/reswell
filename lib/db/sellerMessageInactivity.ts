import type { SupabaseClient } from "@supabase/supabase-js"

export const SELLER_MESSAGE_INACTIVITY_DAYS = 7 as const

export type SellerMessageInactivityEligibleRow = {
  conversation_id: string
  listing_id: string
  seller_id: string
  buyer_id: string
  buyer_message_id: string
  buyer_message_content: string
  buyer_message_at: string
  listing_title: string
  listing_slug: string | null
  listing_section: string
}

/**
 * Conversations whose latest message is from the buyer, older than `cutoff`, on a live
 * listing not already on vacation — and not yet actioned for that buyer message.
 */
export async function fetchListingsEligibleForSellerMessageInactivity(
  supabase: SupabaseClient,
  cutoff: Date,
): Promise<{ data: SellerMessageInactivityEligibleRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc("listings_eligible_for_seller_message_inactivity", {
    p_cutoff: cutoff.toISOString(),
  })

  if (error) {
    return { data: [], error: error.message }
  }

  const rows = Array.isArray(data) ? data : []
  const typed: SellerMessageInactivityEligibleRow[] = rows.map((r: Record<string, unknown>) => ({
    conversation_id: String(r.conversation_id),
    listing_id: String(r.listing_id),
    seller_id: String(r.seller_id),
    buyer_id: String(r.buyer_id),
    buyer_message_id: String(r.buyer_message_id),
    buyer_message_content: String(r.buyer_message_content ?? ""),
    buyer_message_at: String(r.buyer_message_at),
    listing_title: String(r.listing_title ?? ""),
    listing_slug: typeof r.listing_slug === "string" ? r.listing_slug : null,
    listing_section: String(r.listing_section ?? ""),
  }))

  return { data: typed, error: null }
}

export type RecordSellerMessageInactivityActionInput = {
  listingId: string
  conversationId: string
  sellerId: string
  buyerMessageId: string
  buyerMessageAt: string
  vacationAppliedAt: string | null
  klaviyoSentAt: string | null
}

export async function recordSellerMessageInactivityAction(
  supabase: SupabaseClient,
  input: RecordSellerMessageInactivityActionInput,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("seller_message_inactivity_actions").upsert(
    {
      listing_id: input.listingId,
      conversation_id: input.conversationId,
      seller_id: input.sellerId,
      buyer_message_id: input.buyerMessageId,
      buyer_message_at: input.buyerMessageAt,
      vacation_applied_at: input.vacationAppliedAt,
      klaviyo_sent_at: input.klaviyoSentAt,
    },
    { onConflict: "conversation_id,buyer_message_id" },
  )

  if (error) return { error: error.message }
  return { error: null }
}
