import type { MessagePolicyReasonCode } from "@/lib/messages/fraud-reason-codes"
import { messageAppearsToShareEmailAddress } from "@/lib/utils/detect-message-email-sharing"
import { messageContainsOffPlatformPaymentTerms } from "@/lib/utils/detect-message-off-platform-payment"
import { messageAppearsToSharePhoneNumber } from "@/lib/utils/detect-message-phone-sharing"

export type DetectMessagePolicyViolationOptions = {
  /** Marketplace admins (`profiles.is_admin`) may share phone numbers in DMs. */
  allowPhoneSharing?: boolean
}

export function detectMessagePolicyViolation(
  text: string,
  options?: DetectMessagePolicyViolationOptions,
): MessagePolicyReasonCode | null {
  const t = text.trim()
  if (!t) return null

  if (messageAppearsToSharePhoneNumber(t) && !options?.allowPhoneSharing) return "phone_like"
  if (messageAppearsToShareEmailAddress(t)) return "email_like"
  if (messageContainsOffPlatformPaymentTerms(t)) return "off_platform_payment"

  return null
}
