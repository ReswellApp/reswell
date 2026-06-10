import type { MessagePolicyReasonCode } from "@/lib/messages/fraud-reason-codes"

const POLICY_NOTICE_BODY =
  "Keep your conversation here so deals stay on the platform and our team can help if something goes wrong."

export function getMessagePolicyNotice(reasonCode: MessagePolicyReasonCode): {
  heading: string
  body: string
} {
  switch (reasonCode) {
    case "phone_like":
      return {
        heading: "Phone numbers aren’t allowed in messages",
        body: `Sharing phone numbers goes against Reswell policy. ${POLICY_NOTICE_BODY}`,
      }
    case "email_like":
      return {
        heading: "Email addresses aren’t allowed in messages",
        body: `Sharing email addresses goes against Reswell policy. ${POLICY_NOTICE_BODY}`,
      }
    case "off_platform_payment":
      return {
        heading: "Off-platform payments aren’t allowed in messages",
        body: `Asking for Venmo, PayPal, cash, or other off-platform payment goes against Reswell policy. ${POLICY_NOTICE_BODY}`,
      }
    default: {
      const _exhaustive: never = reasonCode
      return _exhaustive
    }
  }
}

/** @deprecated Use {@link getMessagePolicyNotice} */
export const PHONE_SHARING_POLICY_HEADING = getMessagePolicyNotice("phone_like").heading

/** @deprecated Use {@link getMessagePolicyNotice} */
export const PHONE_SHARING_POLICY_BODY = getMessagePolicyNotice("phone_like").body
