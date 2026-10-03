import type { SupabaseClient } from "@supabase/supabase-js"
import type { MessagePolicyReasonCode } from "@/lib/messages/fraud-reason-codes"
import type {
  MessageFraudLlmReviewStatus,
  MessageFraudReviewSource,
} from "@/lib/validations/message-fraud-review"

export interface FraudMessageRow {
  id: string
  conversation_id: string
  sender_id: string
  recipient_id: string
  listing_id: string | null
  content: string
  reason_code: string
  created_at: string
  llm_review_status: string
  llm_review_reason_code: string | null
  llm_review_rationale: string | null
  llm_reviewed_at: string | null
  llm_review_source: string | null
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
  llm_review_status,
  llm_review_reason_code,
  llm_review_rationale,
  llm_reviewed_at,
  llm_review_source,
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
    reasonCode?: MessagePolicyReasonCode
    llmReviewStatus?: MessageFraudLlmReviewStatus
    llmReviewReasonCode?: MessagePolicyReasonCode | null
    llmReviewRationale?: string | null
    llmReviewSource?: MessageFraudReviewSource
  },
): Promise<{ ok: boolean; errorMessage?: string }> {
  const reviewed = row.llmReviewStatus && row.llmReviewStatus !== "pending"
  const { error } = await supabase.from("fraud_messages").insert({
    conversation_id: row.conversationId,
    sender_id: row.senderId,
    recipient_id: row.recipientId,
    listing_id: row.listingId,
    content: row.content,
    reason_code: row.reasonCode ?? "phone_like",
    llm_review_status: row.llmReviewStatus ?? "pending",
    llm_review_reason_code: row.llmReviewReasonCode ?? null,
    llm_review_rationale: row.llmReviewRationale ?? null,
    llm_reviewed_at: reviewed ? new Date().toISOString() : null,
    llm_review_source: row.llmReviewSource ?? "send",
  })

  if (error) {
    console.error("[fraud_messages] insert:", error.message)
    return { ok: false, errorMessage: error.message }
  }

  return { ok: true }
}

const BLOCKING_FRAUD_REVIEW_STATUSES = ["pending", "confirmed"] as const

/** Phishing / impersonation DMs that still count toward a new-account ban. */
export async function countPhishingFraudMessagesForSender(
  supabase: SupabaseClient,
  senderId: string,
): Promise<number | null> {
  const { count, error } = await supabase
    .from("fraud_messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", senderId)
    .or("reason_code.eq.phishing_like,llm_review_reason_code.eq.phishing_like")
    .in("llm_review_status", [...BLOCKING_FRAUD_REVIEW_STATUSES])

  if (error) {
    console.error("[countPhishingFraudMessagesForSender]", error.message)
    return null
  }

  return count ?? 0
}

/** Recipients this sender tried to DM with a blocked fraud attempt in the window. */
export async function listDistinctFraudRecipientIdsSince(
  supabase: SupabaseClient,
  senderId: string,
  sinceIso: string,
): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("fraud_messages")
    .select("recipient_id")
    .eq("sender_id", senderId)
    .gte("created_at", sinceIso)

  if (error) {
    console.error("[listDistinctFraudRecipientIdsSince]", error.message)
    return null
  }

  const ids = new Set<string>()
  for (const row of data ?? []) {
    if (typeof row.recipient_id === "string" && row.recipient_id.length > 0) {
      ids.add(row.recipient_id)
    }
  }
  return [...ids]
}

export interface PendingFraudMessageReviewRow {
  id: string
  content: string
  reason_code: string
  conversation_id: string
  sender_id: string
}

export async function listPendingFraudMessagesForReview(
  supabase: SupabaseClient,
  limit: number,
): Promise<PendingFraudMessageReviewRow[]> {
  const { data, error } = await supabase
    .from("fraud_messages")
    .select("id, content, reason_code, conversation_id, sender_id")
    .eq("llm_review_status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit)

  if (error) {
    console.error("[fraud_messages] list pending review:", error.message)
    return []
  }

  return (data ?? []) as PendingFraudMessageReviewRow[]
}

export async function updateFraudMessageLlmReview(
  supabase: SupabaseClient,
  id: string,
  review: {
    status: Exclude<MessageFraudLlmReviewStatus, "pending">
    reasonCode: MessagePolicyReasonCode | null
    rationale: string | null
    source: MessageFraudReviewSource
  },
): Promise<{ ok: boolean }> {
  const { error } = await supabase
    .from("fraud_messages")
    .update({
      llm_review_status: review.status,
      llm_review_reason_code: review.reasonCode,
      llm_review_rationale: review.rationale,
      llm_reviewed_at: new Date().toISOString(),
      llm_review_source: review.source,
    })
    .eq("id", id)

  if (error) {
    console.error("[fraud_messages] update llm review:", error.message)
    return { ok: false }
  }

  return { ok: true }
}
