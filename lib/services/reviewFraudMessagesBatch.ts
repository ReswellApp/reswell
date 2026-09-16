/**
 * Re-reviews fraud_messages rows that were blocked without a Gemini verdict
 * (send-path timeout, LLM disabled, or historical captures).
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { getTrailingMessagesForConversation } from "@/lib/db/conversationTrailingMessages"
import {
  listPendingFraudMessagesForReview,
  updateFraudMessageLlmReview,
} from "@/lib/db/fraudMessages"
import { isMessagePolicyReasonCode } from "@/lib/messages/fraud-reason-codes"
import {
  applyMessageFraudReviewDecision,
  fallbackReasonForHeuristic,
  type MessagePolicyHeuristic,
} from "@/lib/messages/message-fraud-fail-policy"
import {
  isMessageFraudReviewEnabled,
  MESSAGE_FRAUD_REVIEW_BATCH_TIMEOUT_MS,
  reviewMarketplaceMessageForFraud,
} from "@/lib/services/messageFraudReview"
import { messageContainsAmbiguousCashTerm } from "@/lib/utils/detect-message-off-platform-payment"

const DEFAULT_BATCH_LIMIT = 20

export type FraudMessageBatchReviewSummary = {
  attempted: number
  confirmed: number
  dismissed: number
  unavailable: number
  errors: number
}

function heuristicFromStoredReason(reasonCode: string): MessagePolicyHeuristic {
  return isMessagePolicyReasonCode(reasonCode) ? reasonCode : "evasion_suspect"
}

async function priorSenderMessages(
  supabase: SupabaseClient,
  conversationId: string,
  senderId: string,
): Promise<string[]> {
  const recent = await getTrailingMessagesForConversation(supabase, conversationId, 6)
  const prior: string[] = []
  for (const row of recent) {
    if (row.sender_id !== senderId) break
    prior.unshift(row.content)
  }
  return prior
}

export async function reviewPendingFraudMessagesBatch(
  supabase: SupabaseClient,
  options?: { limit?: number },
): Promise<FraudMessageBatchReviewSummary> {
  const summary: FraudMessageBatchReviewSummary = {
    attempted: 0,
    confirmed: 0,
    dismissed: 0,
    unavailable: 0,
    errors: 0,
  }

  if (!isMessageFraudReviewEnabled()) {
    return summary
  }

  const limit = Math.min(Math.max(options?.limit ?? DEFAULT_BATCH_LIMIT, 1), 50)
  const rows = await listPendingFraudMessagesForReview(supabase, limit)

  for (const row of rows) {
    summary.attempted += 1
    const heuristic = heuristicFromStoredReason(row.reason_code)

    try {
      const review = await reviewMarketplaceMessageForFraud({
        text: row.content,
        heuristic,
        priorSenderMessages: await priorSenderMessages(
          supabase,
          row.conversation_id,
          row.sender_id,
        ),
        timeoutMs: MESSAGE_FRAUD_REVIEW_BATCH_TIMEOUT_MS,
      })

      const decided = applyMessageFraudReviewDecision({
        heuristic,
        ambiguousCash:
          heuristic === "off_platform_payment" && messageContainsAmbiguousCashTerm(row.content),
        review,
      })

      if (!review) {
        // Leave pending so the next cron retry can confirm or dismiss.
        summary.unavailable += 1
        continue
      }

      if (decided.action === "allow") {
        const updated = await updateFraudMessageLlmReview(supabase, row.id, {
          status: "dismissed",
          reasonCode: review.reason_code,
          rationale: review.rationale,
          source: "batch",
        })
        if (!updated.ok) summary.errors += 1
        else summary.dismissed += 1
        continue
      }

      const updated = await updateFraudMessageLlmReview(supabase, row.id, {
        status: decided.llmReviewStatus === "pending" ? "confirmed" : decided.llmReviewStatus,
        reasonCode: decided.reasonCode ?? fallbackReasonForHeuristic(heuristic),
        rationale: review.rationale,
        source: "batch",
      })
      if (!updated.ok) summary.errors += 1
      else if (decided.llmReviewStatus === "dismissed") summary.dismissed += 1
      else summary.confirmed += 1
    } catch (err) {
      console.error("[reviewFraudMessagesBatch] row failed:", err)
      summary.errors += 1
    }
  }

  return summary
}
