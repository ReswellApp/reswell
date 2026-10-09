import {
  MESSAGE_BLOCKED_ACCOUNT_RESTRICTED_ERROR,
  isMessageSendRestrictionResult,
} from "@/lib/messages/send-restriction-errors"

export function isSendRestrictionResult(result: unknown): boolean {
  return isMessageSendRestrictionResult(result)
}

export function isAccountRestrictedSendResult(result: unknown): boolean {
  return (
    isMessageSendRestrictionResult(result) &&
    result.restrictionCode === MESSAGE_BLOCKED_ACCOUNT_RESTRICTED_ERROR
  )
}

export function sendRestrictionMessageFromResult(result: unknown): string | null {
  if (!isMessageSendRestrictionResult(result)) return null
  return result.error
}
