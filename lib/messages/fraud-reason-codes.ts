export const MESSAGE_POLICY_REASON_CODES = [
  "phone_like",
  "phone_fragment",
  "email_like",
  "off_platform_payment",
  "phishing_like",
  "external_link",
] as const

export type MessagePolicyReasonCode = (typeof MESSAGE_POLICY_REASON_CODES)[number]

export function isMessagePolicyReasonCode(value: string): value is MessagePolicyReasonCode {
  return (MESSAGE_POLICY_REASON_CODES as readonly string[]).includes(value)
}

export function messagePolicyReasonLabel(code: MessagePolicyReasonCode): string {
  switch (code) {
    case "phone_like":
      return "Phone number"
    case "phone_fragment":
      return "Phone number (split across messages)"
    case "email_like":
      return "Email address"
    case "off_platform_payment":
      return "Off-platform payment"
    case "phishing_like":
      return "Phishing / impersonation scam"
    case "external_link":
      return "External link (low-trust account)"
    default: {
      const _exhaustive: never = code
      return _exhaustive
    }
  }
}

/**
 * Phone sharing is captured for staff review but still delivered.
 * Every other reason code still blocks the send and shows the sender an error.
 */
export function messagePolicyBlocksDelivery(code: MessagePolicyReasonCode): boolean {
  switch (code) {
    case "phone_like":
    case "phone_fragment":
      return false
    case "email_like":
    case "off_platform_payment":
    case "phishing_like":
    case "external_link":
      return true
    default: {
      const _exhaustive: never = code
      return _exhaustive
    }
  }
}
