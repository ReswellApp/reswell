import {
  PHONE_SHARING_POLICY_ENFORCED,
  isPhoneSharingPolicyReason,
  type MessagePolicyReasonCode,
} from "./fraud-reason-codes.ts"
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
 * When the LLM is down or times out: block emails / named payment apps / phishing.
 * Phone numbers are allowed for now. Do not block isolated “cash” or evasion-only
 * suspicion — those are the false-positive cases the model is meant to clear.
 */
export function heuristicFailsClosedWhenLlmUnavailable(
  heuristic: MessagePolicyHeuristic,
  options?: { ambiguousCash?: boolean },
): boolean {
  if (heuristic === "evasion_suspect") return false
  if (!PHONE_SHARING_POLICY_ENFORCED && isPhoneSharingPolicyReason(heuristic)) return false
  if (heuristic === "off_platform_payment" && options?.ambiguousCash) return false
  return true
}

function isHighPrecisionHeuristic(
  heuristic: MessagePolicyHeuristic,
  ambiguousCash: boolean,
): boolean {
  if (!PHONE_SHARING_POLICY_ENFORCED && isPhoneSharingPolicyReason(heuristic)) return false
  if (HIGH_PRECISION_HEURISTICS.has(heuristic)) return true
  return heuristic === "off_platform_payment" && !ambiguousCash
}

function allowPausedPhoneSharing(reasonCode: MessagePolicyReasonCode | null): boolean {
  return !PHONE_SHARING_POLICY_ENFORCED && isPhoneSharingPolicyReason(reasonCode)
}

/**
 * Merge a regex/heuristic hit with an optional LLM verdict.
 *
 * - Confirmed block → stop delivery.
 * - Confident allow → deliver (false-positive word used innocently).
 * - Weak allow on a high-precision heuristic (clear email, Venmo, etc.) → still
 *   block and leave the row pending for the batch reviewer.
 * - Phone numbers are allowed and are not recorded as fraud.
 * - Unavailable LLM → fail closed only for high-precision heuristics.
 */
export function applyMessageFraudReviewDecision(input: {
  heuristic: MessagePolicyHeuristic
  ambiguousCash: boolean
  review: MessageFraudReviewResult | null
}): MessageFraudReviewDecision {
  const fallbackReason = fallbackReasonForHeuristic(input.heuristic)

  if (allowPausedPhoneSharing(input.heuristic === "evasion_suspect" ? null : input.heuristic)) {
    return { action: "allow", reasonCode: null, llmReviewStatus: "dismissed" }
  }

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
    const reasonCode = input.review.reason_code ?? fallbackReason
    if (allowPausedPhoneSharing(reasonCode)) {
      // Regex already caught email, payment, phishing, or a link. Keep that
      // block even when the model labels the same message as a phone number.
      if (
        input.heuristic !== "evasion_suspect" &&
        !isPhoneSharingPolicyReason(input.heuristic)
      ) {
        return {
          action: "block",
          reasonCode: input.heuristic,
          llmReviewStatus: "confirmed",
        }
      }
      return { action: "allow", reasonCode: null, llmReviewStatus: "dismissed" }
    }
    return {
      action: "block",
      reasonCode,
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
