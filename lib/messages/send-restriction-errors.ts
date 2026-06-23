export const MESSAGE_BLOCKED_ACCOUNT_RESTRICTED_ERROR =
  "messages_account_restricted" as const

export const MESSAGE_BLOCKED_RATE_LIMITED_ERROR = "messages_rate_limited" as const

export const PURCHASE_BLOCKED_ACCOUNT_RESTRICTED_ERROR =
  "purchase_account_restricted" as const

export type MessageSendRestrictionCode =
  | typeof MESSAGE_BLOCKED_ACCOUNT_RESTRICTED_ERROR
  | typeof MESSAGE_BLOCKED_RATE_LIMITED_ERROR

export type MessageSendRestrictionActionResult = {
  error: string
  restrictionCode: MessageSendRestrictionCode
  restrictedUntil: string
}

type MessageSendRestrictionCodeResult = {
  restrictionCode: MessageSendRestrictionCode
  restrictedUntil: string
}

export type { MessageSendRestrictionCodeResult }

export function isMessageSendRestrictionResult(
  result: unknown,
): result is MessageSendRestrictionActionResult {
  if (result == null || typeof result !== "object") return false
  const r = result as { restrictionCode?: unknown; restrictedUntil?: unknown; error?: unknown }
  return (
    (r.restrictionCode === MESSAGE_BLOCKED_ACCOUNT_RESTRICTED_ERROR ||
      r.restrictionCode === MESSAGE_BLOCKED_RATE_LIMITED_ERROR) &&
    typeof r.restrictedUntil === "string" &&
    typeof r.error === "string"
  )
}

export function messageSendRestrictionFromResult(
  result: unknown,
): MessageSendRestrictionActionResult | null {
  return isMessageSendRestrictionResult(result) ? result : null
}

export function formatMessageSendRestrictionError(result: MessageSendRestrictionActionResult): string {
  return result.error
}
