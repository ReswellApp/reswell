import type { SupabaseClient } from "@supabase/supabase-js"

export const SELLER_MESSAGE_REMINDER_DAYS = 3 as const
export const SELLER_MESSAGE_WARNING_DAYS = 6 as const
export const SELLER_MESSAGE_INACTIVITY_DAYS = 7 as const

export type SellerMessageReminderStage = "day3" | "day6" | "day7"

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
  reminder_3d_at: string | null
  warning_6d_at: string | null
  vacation_applied_at: string | null
}

/**
 * Conversations whose latest message is from the buyer, older than `cutoff`, on a live
 * listing that has not been auto-hidden for that buyer message yet.
 * `cutoff` is the day-3 mark. The service decides which milestone is due.
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
    reminder_3d_at: typeof r.reminder_3d_at === "string" ? r.reminder_3d_at : null,
    warning_6d_at: typeof r.warning_6d_at === "string" ? r.warning_6d_at : null,
    vacation_applied_at: typeof r.vacation_applied_at === "string" ? r.vacation_applied_at : null,
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
  hiddenNotifiedAt?: string | null
}

export type RecordSellerMessageReminderInput = {
  listingId: string
  conversationId: string
  sellerId: string
  buyerMessageId: string
  buyerMessageAt: string
  stage: Extract<SellerMessageReminderStage, "day3" | "day6">
  notifiedAt: string
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
      hidden_notified_at: input.hiddenNotifiedAt ?? null,
    },
    { onConflict: "conversation_id,buyer_message_id" },
  )

  if (error) return { error: error.message }
  return { error: null }
}

/** Marks day 3 or day 6 complete without clearing a later milestone. */
export async function recordSellerMessageReminder(
  supabase: SupabaseClient,
  input: RecordSellerMessageReminderInput,
): Promise<{ error: string | null }> {
  const milestone =
    input.stage === "day3"
      ? { reminder_3d_at: input.notifiedAt }
      : { warning_6d_at: input.notifiedAt }

  const { error } = await supabase.from("seller_message_inactivity_actions").upsert(
    {
      listing_id: input.listingId,
      conversation_id: input.conversationId,
      seller_id: input.sellerId,
      buyer_message_id: input.buyerMessageId,
      buyer_message_at: input.buyerMessageAt,
      ...milestone,
    },
    { onConflict: "conversation_id,buyer_message_id" },
  )

  if (error) return { error: error.message }
  return { error: null }
}
