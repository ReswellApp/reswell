import {
  ACCOUNT_BANNED_USER_MESSAGE,
  PERMANENT_ACCOUNT_RESTRICTED_UNTIL,
} from "./account-ban-errors.ts"
import {
  messagePolicyBlocksDelivery,
  type MessagePolicyReasonCode,
} from "./fraud-reason-codes.ts"
import { MESSAGE_BLOCKED_POLICY_ERROR, type MessagePolicyBlockedActionResult } from "./policy-errors.ts"
import {
  MESSAGE_BLOCKED_ACCOUNT_RESTRICTED_ERROR,
  type MessageSendRestrictionActionResult,
} from "./send-restriction-errors.ts"

/**
 * /messages bot + fraud protocol
 *
 * 1. Send guard — every marketplace DM / offer:
 *    restriction lock, new-account IP/device match → permanent ban,
 *    unique-recipient rate limit over delivered DMs ∪ blocked fraud attempts.
 * 2. Content policy — heuristic + LLM; blocked text is never delivered.
 * 3. New-account phishing auto-ban — account < 24h and 3 blocking phishing
 *    strikes (stored reason or LLM remap). Phone / email / Venmo / cash never ban.
 * 4. After a ban — return the account-restricted send result, ban IP (14d) and
 *    device (1y), and block signup on those signals.
 * 5. Batch LLM — confirm/dismiss pending rows; confirmed phishing re-runs (3).
 */

const BLOCKING_FRAUD_REVIEW_STATUSES = new Set(["pending", "confirmed"])

export function unionRecipientIds(
  deliveredIds: readonly string[],
  fraudAttemptIds: readonly string[],
): string[] {
  return [...new Set([...deliveredIds, ...fraudAttemptIds])]
}

export function shouldRateLimitNewRecipient(input: {
  distinctRecipientIds: readonly string[]
  recipientId: string
  maxUniqueRecipients: number
}): boolean {
  if (input.distinctRecipientIds.includes(input.recipientId)) return false
  return input.distinctRecipientIds.length >= input.maxUniqueRecipients
}

export function fraudRowCountsTowardPhishingBan(row: {
  reasonCode: string
  llmReviewReasonCode?: string | null
  llmReviewStatus: string
}): boolean {
  if (!BLOCKING_FRAUD_REVIEW_STATUSES.has(row.llmReviewStatus)) return false
  return row.reasonCode === "phishing_like" || row.llmReviewReasonCode === "phishing_like"
}

export function accountBannedSendRestrictionResult(): MessageSendRestrictionActionResult {
  return {
    error: ACCOUNT_BANNED_USER_MESSAGE,
    restrictionCode: MESSAGE_BLOCKED_ACCOUNT_RESTRICTED_ERROR,
    restrictedUntil: PERMANENT_ACCOUNT_RESTRICTED_UNTIL,
  }
}

export function sendResultAfterBlockedFraudCapture(input: {
  reasonCode: MessagePolicyReasonCode
  banned: boolean
}): MessagePolicyBlockedActionResult | MessageSendRestrictionActionResult | null {
  if (input.banned) {
    return accountBannedSendRestrictionResult()
  }
  if (!messagePolicyBlocksDelivery(input.reasonCode)) {
    return null
  }
  return { error: MESSAGE_BLOCKED_POLICY_ERROR, policyReason: input.reasonCode }
}
