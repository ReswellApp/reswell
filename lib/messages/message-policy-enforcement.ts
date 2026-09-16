import type { SupabaseClient } from "@supabase/supabase-js"
import type { MessagePolicyReasonCode } from "@/lib/messages/fraud-reason-codes"
import { getTrailingMessagesForConversation } from "@/lib/db/conversationTrailingMessages"
import {
  applyMessageFraudReviewDecision,
  type MessagePolicyHeuristic,
} from "@/lib/messages/message-fraud-fail-policy"
import type { MessageFraudLlmReviewStatus } from "@/lib/validations/message-fraud-review"
import { evaluateMessageSenderTrust } from "@/lib/services/messageSenderTrust"
import {
  messageFraudReviewSendTimeoutMs,
  reviewMarketplaceMessageForFraud,
} from "@/lib/services/messageFraudReview"
import {
  detectExternalLinkPolicyViolation,
  detectMessagePolicyViolation,
} from "@/lib/utils/detect-message-policy-violation"
import { messageLooksLikeFraudEvasion } from "@/lib/utils/detect-message-fraud-evasion"
import { messageContainsAmbiguousCashTerm } from "@/lib/utils/detect-message-off-platform-payment"
import {
  fragmentsCombineIntoPhoneNumber,
  messageIsPhoneNumberFragmentCandidate,
} from "@/lib/utils/detect-message-phone-fragments"

export type MessagePolicyStaffProfile = {
  is_admin: boolean | null
  is_employee: boolean | null
}

export type MessagePolicySendDecision = {
  reasonCode: MessagePolicyReasonCode
  llmReviewStatus: MessageFraudLlmReviewStatus
  llmReviewRationale: string | null
  llmReviewReasonCode: MessagePolicyReasonCode | null
}

/** Staff accounts may send phone/email/off-platform terms in marketplace DMs (support use). */
export function profileBypassesMessagePolicy(
  profile: MessagePolicyStaffProfile | null | undefined,
): boolean {
  return profile?.is_admin === true || profile?.is_employee === true
}

async function detectHeuristicViolationForSender(
  supabase: SupabaseClient,
  senderId: string,
  text: string,
): Promise<MessagePolicyReasonCode | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee, created_at, phone")
    .eq("id", senderId)
    .maybeSingle()

  if (profileBypassesMessagePolicy(profile)) {
    return null
  }

  const universalViolation = detectMessagePolicyViolation(text)
  if (universalViolation) return universalViolation

  const trustProfile =
    profile && typeof profile.created_at === "string"
      ? {
          createdAt: profile.created_at,
          phone: typeof profile.phone === "string" ? profile.phone : null,
        }
      : null

  const { isEstablished } = await evaluateMessageSenderTrust(supabase, senderId, trustProfile)
  if (!isEstablished && detectExternalLinkPolicyViolation(text)) {
    return "external_link"
  }

  return null
}

async function detectPhoneFragmentViolation(
  supabase: SupabaseClient,
  senderId: string,
  conversationId: string,
  text: string,
  priorSenderMessages: string[],
): Promise<MessagePolicyReasonCode | null> {
  if (!messageIsPhoneNumberFragmentCandidate(text)) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", senderId)
    .maybeSingle()
  if (profileBypassesMessagePolicy(profile)) return null

  if (fragmentsCombineIntoPhoneNumber(priorSenderMessages, text)) {
    return "phone_fragment"
  }

  return null
}

function priorSenderRun(recent: { sender_id: string; content: string }[], senderId: string): string[] {
  const priorFragments: string[] = []
  for (const row of recent) {
    if (row.sender_id !== senderId) break
    priorFragments.unshift(row.content)
  }
  return priorFragments
}

async function confirmHeuristicWithLlm(input: {
  text: string
  heuristic: MessagePolicyHeuristic
  priorSenderMessages: string[]
}): Promise<MessagePolicySendDecision | null> {
  const review = await reviewMarketplaceMessageForFraud({
    text: input.text,
    heuristic: input.heuristic,
    priorSenderMessages: input.priorSenderMessages,
    timeoutMs: messageFraudReviewSendTimeoutMs(),
  })

  const decided = applyMessageFraudReviewDecision({
    heuristic: input.heuristic,
    ambiguousCash:
      input.heuristic === "off_platform_payment" && messageContainsAmbiguousCashTerm(input.text),
    review,
  })

  if (decided.action === "allow" || !decided.reasonCode) {
    return null
  }

  return {
    reasonCode: decided.reasonCode,
    llmReviewStatus: decided.llmReviewStatus,
    llmReviewRationale: review?.rationale ?? null,
    llmReviewReasonCode: review?.reason_code ?? null,
  }
}

/**
 * Regex + trust + fragment detection, then a fast LLM confirm/dismiss when
 * something looks like fraud or evasion. Clean messages never call the model.
 */
async function priorSenderMessagesForConversation(
  supabase: SupabaseClient,
  conversationId: string | null,
  senderId: string,
): Promise<string[]> {
  if (!conversationId) return []
  const recent = await getTrailingMessagesForConversation(supabase, conversationId, 6)
  return priorSenderRun(recent, senderId)
}

export async function evaluateMessagePolicyForSend(
  supabase: SupabaseClient,
  senderId: string,
  conversationId: string | null,
  text: string,
): Promise<MessagePolicySendDecision | null> {
  const singleMessageHeuristic = await detectHeuristicViolationForSender(supabase, senderId, text)

  if (singleMessageHeuristic) {
    const priorSenderMessages = await priorSenderMessagesForConversation(
      supabase,
      conversationId,
      senderId,
    )
    return confirmHeuristicWithLlm({
      text,
      heuristic: singleMessageHeuristic,
      priorSenderMessages,
    })
  }

  let priorSenderMessages: string[] | null = null
  if (conversationId && messageIsPhoneNumberFragmentCandidate(text)) {
    priorSenderMessages = await priorSenderMessagesForConversation(
      supabase,
      conversationId,
      senderId,
    )
    const fragment = await detectPhoneFragmentViolation(
      supabase,
      senderId,
      conversationId,
      text,
      priorSenderMessages,
    )
    if (fragment) {
      return confirmHeuristicWithLlm({
        text,
        heuristic: fragment,
        priorSenderMessages,
      })
    }
  }

  if (messageLooksLikeFraudEvasion(text)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, is_employee")
      .eq("id", senderId)
      .maybeSingle()
    if (profileBypassesMessagePolicy(profile)) return null

    return confirmHeuristicWithLlm({
      text,
      heuristic: "evasion_suspect",
      priorSenderMessages:
        priorSenderMessages ??
        (await priorSenderMessagesForConversation(supabase, conversationId, senderId)),
    })
  }

  return null
}

export async function getMessagePolicyViolationForSender(
  supabase: SupabaseClient,
  senderId: string,
  text: string,
): Promise<MessagePolicyReasonCode | null> {
  const decision = await evaluateMessagePolicyForSend(supabase, senderId, null, text)
  return decision?.reasonCode ?? null
}

/**
 * Same as {@link getMessagePolicyViolationForSender}, plus a cross-message check:
 * phone numbers split into short digit-only messages ("843" / "997" / "5252")
 * are caught by combining the sender's trailing digit-only messages with the
 * new one. Phone hits now block delivery after LLM confirm (or fail-closed).
 */
export async function getMessagePolicyViolationForSenderInConversation(
  supabase: SupabaseClient,
  senderId: string,
  conversationId: string,
  text: string,
): Promise<MessagePolicyReasonCode | null> {
  const decision = await evaluateMessagePolicyForSend(
    supabase,
    senderId,
    conversationId,
    text,
  )
  return decision?.reasonCode ?? null
}
