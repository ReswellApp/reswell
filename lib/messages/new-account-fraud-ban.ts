import {
  messagePolicyCountsTowardPhishingBan,
  type MessagePolicyReasonCode,
} from "./fraud-reason-codes.ts"

/** Ban a brand-new account after this many phishing / impersonation DMs. */
export const NEW_ACCOUNT_FRAUD_BAN_THRESHOLD = 3

/** Only accounts younger than this are auto-banned. */
export const NEW_ACCOUNT_FRAUD_BAN_MAX_AGE_MS = 24 * 60 * 60 * 1000

export const NEW_ACCOUNT_FRAUD_BAN_REASON =
  "Permanent ban: new account (under 24 hours) sent 3 phishing / impersonation marketplace messages."

export const NEW_ACCOUNT_BANNED_SIGNAL_REASON =
  "Permanent ban: new account used an IP or device already banned for phishing."

export function isAccountNewerThanFraudBanWindow(
  accountCreatedAt: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!accountCreatedAt) return false
  const createdMs = Date.parse(accountCreatedAt)
  if (!Number.isFinite(createdMs)) return false
  return nowMs - createdMs < NEW_ACCOUNT_FRAUD_BAN_MAX_AGE_MS
}

/**
 * True when a sender should be permanently banned: account is under 24 hours
 * old and they have at least 3 blocked phishing / fake-Reswell / click-a-link
 * DMs. Phone, email, and off-platform payment blocks never qualify.
 */
export function shouldPermanentlyBanNewAccountForFraud(input: {
  accountCreatedAt: string | null | undefined
  phishingMessageCount: number
  latestReasonCode?: MessagePolicyReasonCode | null
  nowMs?: number
}): boolean {
  if (
    input.latestReasonCode &&
    !messagePolicyCountsTowardPhishingBan(input.latestReasonCode)
  ) {
    return false
  }
  if (input.phishingMessageCount < NEW_ACCOUNT_FRAUD_BAN_THRESHOLD) return false
  return isAccountNewerThanFraudBanWindow(input.accountCreatedAt, input.nowMs)
}
