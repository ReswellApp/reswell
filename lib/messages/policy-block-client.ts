import type { MessagePolicyReasonCode } from "@/lib/messages/fraud-reason-codes"
import {
  isMessagePolicyBlockedResult,
  messagePolicyBlockedReasonFromResult,
} from "@/lib/messages/policy-errors"

export function getPolicyBlockFromSendResult(result: unknown): MessagePolicyReasonCode | null {
  return messagePolicyBlockedReasonFromResult(result)
}

export function isPolicyBlockedSendResult(result: unknown): boolean {
  return isMessagePolicyBlockedResult(result)
}
