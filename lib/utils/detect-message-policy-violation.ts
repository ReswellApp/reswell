import {
  PHONE_SHARING_POLICY_ENFORCED,
  type MessagePolicyReasonCode,
} from "../messages/fraud-reason-codes.ts"
import { messageAppearsToShareEmailAddress } from "./detect-message-email-sharing.ts"
import { messageContainsExternalLink } from "./detect-message-external-link.ts"
import { messageAppearsToBePhishing } from "./detect-message-phishing.ts"
import { messageContainsOffPlatformPaymentTerms } from "./detect-message-off-platform-payment.ts"
import { messageAppearsToSharePhoneNumber } from "./detect-message-phone-sharing.ts"

export function detectMessagePolicyViolation(text: string): MessagePolicyReasonCode | null {
  const t = text.trim()
  if (!t) return null

  if (messageAppearsToBePhishing(t)) return "phishing_like"
  if (messageAppearsToShareEmailAddress(t)) return "email_like"
  if (messageContainsOffPlatformPaymentTerms(t)) return "off_platform_payment"
  // Phone is checked last so a message that also contains email / Venmo / phishing
  // still returns that more specific reason. Phone sharing is paused for now.
  if (PHONE_SHARING_POLICY_ENFORCED && messageAppearsToSharePhoneNumber(t)) return "phone_like"

  return null
}

/** External links are gated by sender trust in {@link getMessagePolicyViolationForSender}. */
export function detectExternalLinkPolicyViolation(text: string): MessagePolicyReasonCode | null {
  if (messageContainsExternalLink(text)) return "external_link"
  return null
}
