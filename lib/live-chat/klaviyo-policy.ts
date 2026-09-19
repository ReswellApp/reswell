/**
 * Live-chat ↔ Klaviyo policy.
 *
 * Soft-open stays silent — no “we received your chat” confirmation on every
 * visitor turn. Customer-visible Hayden / David auto-replies and staff replies
 * reuse the existing **Support Tickets Response** metric so a visitor who left
 * an email still gets the answer after they close the tab.
 */

export type LiveChatKlaviyoNotifyReason = "auto_unanswered" | "manual"

/** Soft case open / CS auto-send bootstrap — never notify. */
export function shouldNotifyKlaviyoOnLiveChatSoftOpen(): false {
  return false
}

/** Hayden / David auto-reply or staff desk reply — email when we have an address. */
export function shouldNotifyKlaviyoOnLiveChatReply(args: {
  visitorEmail: string | null | undefined
  content: string
}): boolean {
  return Boolean(args.visitorEmail?.trim() && args.content.trim())
}

/**
 * Formal escalate → Support Tickets (created) email only when a new case was opened.
 * Already-linked soft cases stay silent (member already has chat history).
 */
export function shouldNotifyKlaviyoOnLiveChatEscalation(args: {
  alreadyLinked: boolean
  reason: LiveChatKlaviyoNotifyReason
}): boolean {
  if (args.alreadyLinked) return false
  return args.reason === "manual" || args.reason === "auto_unanswered"
}
