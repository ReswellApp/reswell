/**
 * Live-chat ↔ Klaviyo policy.
 *
 * Soft-launch CS (openLiveChatSupportCase + auto-reply) must never email the
 * member for every chat turn. Klaviyo is reserved for formal escalation /
 * email-worthy staff outcomes — not realtime chat.
 */

export type LiveChatKlaviyoNotifyReason = "auto_unanswered" | "manual"

/** Soft case open / CS auto-send — never notify. */
export function shouldNotifyKlaviyoOnLiveChatSoftOpen(): false {
  return false
}

/** Soft case auto-reply — never notify. */
export function shouldNotifyKlaviyoOnLiveChatAutoReply(): false {
  return false
}

/**
 * Formal escalate → Support Tickets email only when a new case was opened.
 * Already-linked soft cases stay silent (member already has chat history).
 */
export function shouldNotifyKlaviyoOnLiveChatEscalation(args: {
  alreadyLinked: boolean
  reason: LiveChatKlaviyoNotifyReason
}): boolean {
  if (args.alreadyLinked) return false
  return args.reason === "manual" || args.reason === "auto_unanswered"
}
