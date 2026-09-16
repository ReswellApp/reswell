import type { MessagePolicyReasonCode } from "./fraud-reason-codes"
import type {
  MessageFraudLlmReviewStatus,
  MessageFraudReviewResult,
} from "../validations/message-fraud-review"

/** Regex/heuristic hit that triggered a possible-fraud review. */
export type MessagePolicyHeuristic = MessagePolicyReasonCode | "evasion_suspect"

export type MessageFraudReviewDecision = {
  action: "block" | "allow"
  reasonCode: MessagePolicyReasonCode | null
  llmReviewStatus: MessageFraudLlmReviewStatus
}

const HIGH_PRECISION_HEURISTICS = new Set<MessagePolicyHeuristic>([
  "phone_like",
  "phone_fragment",
  "email_like",
  "phishing_like",
  "external_link",
])

export function fallbackReasonForHeuristic(
  heuristic: MessagePolicyHeuristic,
): MessagePolicyReasonCode {
  return heuristic === "evasion_suspect" ? "phone_like" : heuristic
}

/**
 * When the LLM is down or times out: block clear phones / emails / named payment
 * apps / phishing. Do not block isolated “cash” or evasion-only suspicion — those
 * are the false-positive cases the model is meant to clear.
 */
export function heuristicFailsClosedWhenLlmUnavailable(
  heuristic: MessagePolicyHeuristic,
  options?: { ambiguousCash?: boolean },
): boolean {
  if (heuristic === "evasion_suspect") return false
  if (heuristic === "off_platform_payment" && options?.ambiguousCash) return false
  return true
}

function isHighPrecisionHeuristic(
  heuristic: MessagePolicyHeuristic,
  ambiguousCash: boolean,
): boolean {
  if (HIGH_PRECISION_HEURISTICS.has(heuristic)) return true
  return heuristic === "off_platform_payment" && !ambiguousCash
}

/**
 * Merge a regex/heuristic hit with an optional LLM verdict.
 *
 * - Confirmed block → stop delivery.
 * - Confident allow → deliver (false-positive word used innocently).
 * - Weak allow on a high-precision heuristic (clear phone, Venmo, etc.) → still
 *   block and leave the row pending for the batch reviewer.
 * - Unavailable LLM → fail closed only for high-precision heuristics.
 */
export function applyMessageFraudReviewDecision(input: {
  heuristic: MessagePolicyHeuristic
  ambiguousCash: boolean
  review: MessageFraudReviewResult | null
}): MessageFraudReviewDecision {
  const fallbackReason = fallbackReasonForHeuristic(input.heuristic)

  if (!input.review) {
    if (
      heuristicFailsClosedWhenLlmUnavailable(input.heuristic, {
        ambiguousCash: input.ambiguousCash,
      })
    ) {
      return {
        action: "block",
        reasonCode: fallbackReason,
        llmReviewStatus: "pending",
      }
    }
    return { action: "allow", reasonCode: null, llmReviewStatus: "unavailable" }
  }

  if (input.review.decision === "block") {
    return {
      action: "block",
      reasonCode: input.review.reason_code ?? fallbackReason,
      llmReviewStatus: "confirmed",
    }
  }

  const weakAllow = input.review.confidence === "low"
  if (weakAllow && isHighPrecisionHeuristic(input.heuristic, input.ambiguousCash)) {
    return {
      action: "block",
      reasonCode: fallbackReason,
      llmReviewStatus: "pending",
    }
  }

  return { action: "allow", reasonCode: null, llmReviewStatus: "dismissed" }
}
