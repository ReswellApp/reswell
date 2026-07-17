export const MESSAGE_POLICY_REASON_CODES = [
  "phone_like",
  "phone_fragment",
  "email_like",
  "off_platform_payment",
  "phishing_like",
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
    default: {
      const _exhaustive: never = code
      return _exhaustive
    }
  }
}
