/**
 * Live-chat ↔ Klaviyo policy.
 *
 * Soft-open stays silent — no “we received your chat” confirmation on every
 * visitor turn. Customer-visible Hayden / David auto-replies and staff replies
 * reuse the existing **Support Tickets Response** metric so a visitor who left
 * an email still gets the answer after they close the tab.
 *
 * Widget-only tile / tap prompts are rewritten before email. Those controls
 * exist only in the chat widget — a closed-tab visitor cannot tap them.
 */

export type LiveChatKlaviyoNotifyReason = "auto_unanswered" | "manual"

/** Deterministic chat copy that only works next to on-screen tiles. */
const WIDGET_ONLY_REPLY =
  /\b(?:use the tiles below|tap the (?:order|purchase|sale) below|tap one and i'?ll)\b/i

/** Soft case open / CS auto-send bootstrap — never notify. */
export function shouldNotifyKlaviyoOnLiveChatSoftOpen(): false {
  return false
}

/** Chat bodies that tell the visitor to tap tiles the email cannot show. */
export function isLiveChatWidgetOnlyReply(content: string): boolean {
  return WIDGET_ONLY_REPLY.test(content.trim())
}

/**
 * Body for Klaviyo. Widget-only tile / tap prompts become a reopen ask so the
 * email is an answer, not a dead “tap below”.
 */
export function liveChatEmailSafeReplyContent(content: string): string {
  const trimmed = content.trim()
  if (!trimmed) return ""
  if (!isLiveChatWidgetOnlyReply(trimmed)) return trimmed
  if (/ship-from|tiles below/i.test(trimmed)) {
    return "You can update the ship-from address on a label still waiting for carrier drop-off. Reopen the conversation to pick the sale and the new ship-from. Ship-to stays the same."
  }
  if (/bought or sold/i.test(trimmed)) {
    return "I found both purchases and sales in our chat. Reopen the conversation to tell me which, then pick the order."
  }
  return "I found matching orders in our chat. Reopen the conversation to pick the one you mean."
}

/** Hayden / David auto-reply or staff desk reply — email when we have an address. */
export function shouldNotifyKlaviyoOnLiveChatReply(args: {
  visitorEmail: string | null | undefined
  content: string
}): boolean {
  return Boolean(args.visitorEmail?.trim() && liveChatEmailSafeReplyContent(args.content))
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
