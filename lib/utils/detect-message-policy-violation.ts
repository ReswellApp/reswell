import type { MessagePolicyReasonCode } from "@/lib/messages/fraud-reason-codes"
import { messageAppearsToShareEmailAddress } from "@/lib/utils/detect-message-email-sharing"
import { messageContainsExternalLink } from "@/lib/utils/detect-message-external-link"
import { messageAppearsToBePhishing } from "@/lib/utils/detect-message-phishing"
import { messageContainsOffPlatformPaymentTerms } from "@/lib/utils/detect-message-off-platform-payment"
import { messageAppearsToSharePhoneNumber } from "@/lib/utils/detect-message-phone-sharing"

export function detectMessagePolicyViolation(text: string): MessagePolicyReasonCode | null {
  const t = text.trim()
  if (!t) return null

  if (messageAppearsToBePhishing(t)) return "phishing_like"
  if (messageAppearsToShareEmailAddress(t)) return "email_like"
  if (messageContainsOffPlatformPaymentTerms(t)) return "off_platform_payment"
  // Phone is captured for review but does not block delivery. Check last so a
  // message that also contains a blocking violation (email, Venmo, etc.) still
  // returns the blocking reason.
  if (messageAppearsToSharePhoneNumber(t)) return "phone_like"

  return null
}

/** External links are gated by sender trust in {@link getMessagePolicyViolationForSender}. */
export function detectExternalLinkPolicyViolation(text: string): MessagePolicyReasonCode | null {
  if (messageContainsExternalLink(text)) return "external_link"
  return null
}
