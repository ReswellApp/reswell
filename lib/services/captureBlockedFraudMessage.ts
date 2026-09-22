import type { SupabaseClient } from "@supabase/supabase-js"
import { insertFraudMessageCapturedContent } from "@/lib/db/fraudMessages"
import {
  PHONE_SHARING_POLICY_ENFORCED,
  isPhoneSharingPolicyReason,
  messagePolicyBlocksDelivery,
  type MessagePolicyReasonCode,
} from "@/lib/messages/fraud-reason-codes"
import { maybeBanNewAccountAfterFraudMessage } from "@/lib/services/newAccountFraudBan"
import type { MessageFraudLlmReviewStatus, MessageFraudReviewSource } from "@/lib/validations/message-fraud-review"

export async function captureBlockedFraudMessage(
  supabase: SupabaseClient,
  row: {
    conversationId: string
    senderId: string
    recipientId: string
    listingId: string | null
    content: string
    reasonCode: MessagePolicyReasonCode
    llmReviewStatus?: MessageFraudLlmReviewStatus
    llmReviewReasonCode?: MessagePolicyReasonCode | null
    llmReviewRationale?: string | null
    llmReviewSource?: MessageFraudReviewSource
  },
): Promise<{ ok: boolean; banned: boolean; errorMessage?: string }> {
  if (!PHONE_SHARING_POLICY_ENFORCED && isPhoneSharingPolicyReason(row.reasonCode)) {
    return { ok: true, banned: false }
  }

  const inserted = await insertFraudMessageCapturedContent(supabase, row)
  if (!inserted.ok) {
    return { ok: false, banned: false, errorMessage: inserted.errorMessage }
  }

  if (!messagePolicyBlocksDelivery(row.reasonCode)) {
    return { ok: true, banned: false }
  }

  try {
    const ban = await maybeBanNewAccountAfterFraudMessage(
      supabase,
      row.senderId,
      row.reasonCode,
    )
    return { ok: true, banned: ban.banned }
  } catch (error) {
    console.error("[captureBlockedFraudMessage] new-account ban:", error)
    return { ok: true, banned: false }
  }
}
