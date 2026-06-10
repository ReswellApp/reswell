import type { MessagePolicyReasonCode } from "@/lib/messages/fraud-reason-codes"

/** Returned as `result.error` when DM text matched a marketplace messaging policy rule. */
export const MESSAGE_BLOCKED_POLICY_ERROR = "messages_policy_not_allowed" as const

/** @deprecated Use {@link MESSAGE_BLOCKED_POLICY_ERROR} — kept for existing client checks. */
export const MESSAGE_BLOCKED_PHONE_ERROR = MESSAGE_BLOCKED_POLICY_ERROR

export type MessagePolicyBlockedActionResult = {
  error: typeof MESSAGE_BLOCKED_POLICY_ERROR
  policyReason: MessagePolicyReasonCode
}

export function isMessagePolicyBlockedResult(
  result: unknown,
): result is MessagePolicyBlockedActionResult {
  if (result == null || typeof result !== "object") return false
  const r = result as { error?: unknown; policyReason?: unknown }
  return r.error === MESSAGE_BLOCKED_POLICY_ERROR && typeof r.policyReason === "string"
}

export function messagePolicyBlockedReasonFromResult(
  result: unknown,
): MessagePolicyReasonCode | null {
  if (!isMessagePolicyBlockedResult(result)) return null
  return result.policyReason
}
