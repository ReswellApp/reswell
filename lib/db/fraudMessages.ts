import type { SupabaseClient } from "@supabase/supabase-js"

export interface FraudMessageRow {
  id: string
  conversation_id: string
  sender_id: string
  recipient_id: string
  listing_id: string | null
  content: string
  reason_code: string
  created_at: string
  sender_profile: { display_name: string | null } | null
  recipient_profile: { display_name: string | null } | null
}

/** Admin/staff selects for intercepted rows (embed profile display names). */
export const FRAUD_MESSAGES_ADMIN_LIST_SELECT = `
  id,
  conversation_id,
  sender_id,
  recipient_id,
  listing_id,
  content,
  reason_code,
  created_at,
  sender_profile:profiles!fraud_messages_sender_id_fkey (display_name),
  recipient_profile:profiles!fraud_messages_recipient_id_fkey (display_name)
`

export async function insertFraudMessageCapturedContent(
  supabase: SupabaseClient,
  row: {
    conversationId: string
    senderId: string
    recipientId: string
    listingId: string | null
    content: string
    reasonCode?: "phone_like"
  },
): Promise<{ ok: boolean; errorMessage?: string }> {
  const { error } = await supabase.from("fraud_messages").insert({
    conversation_id: row.conversationId,
    sender_id: row.senderId,
    recipient_id: row.recipientId,
    listing_id: row.listingId,
    content: row.content,
    reason_code: row.reasonCode ?? "phone_like",
  })

  if (error) {
    console.error("[fraud_messages] insert:", error.message)
    return { ok: false, errorMessage: error.message }
  }

  return { ok: true }
}
