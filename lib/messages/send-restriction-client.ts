import { isMessageSendRestrictionResult } from "@/lib/messages/send-restriction-errors"

export function isSendRestrictionResult(result: unknown): boolean {
  return isMessageSendRestrictionResult(result)
}

export function sendRestrictionMessageFromResult(result: unknown): string | null {
  if (!isMessageSendRestrictionResult(result)) return null
  return result.error
}
