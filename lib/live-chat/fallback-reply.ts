/**
 * Intent-aware auto-reply when generate is empty, off, times out, or skipped.
 * Presence pings never get a topic catalog. How-tos get a published next step.
 * Unknown asks get a look-into-it line — never silence, a menu, or an order-number ask.
 */

import { isLiveChatPresenceIntent } from "./greeting-intent.ts"
import { isLiveChatSellerPayoutHowtoIntent } from "./howto-intent.ts"
import {
  isLiveChatMarketplaceHowtoIntent,
  isLiveChatSpecificOrderLookupIntent,
  liveChatMessageNamesOrder,
} from "./order-tile-intent.ts"

/** Presence — not a menu. */
export const LIVE_CHAT_PRESENCE_REPLY = "Yeah, I'm here — what's up?"

/** @deprecated Use {@link LIVE_CHAT_PRESENCE_REPLY}. */
export const LIVE_CHAT_GREETING_REPLY = LIVE_CHAT_PRESENCE_REPLY

/** Published buy how-to from Help Center. */
export const LIVE_CHAT_BUY_HOWTO_REPLY =
  "Browse /boards, open a board, and check out through Reswell — card or Reswell Bucks. Pickup or shipping is on the listing. Purchase Protection covers you if it never shows, shows up wrecked, or isn't what was listed. Want help narrowing size or break?"

/** Published seller-payout how-to — no order number, no invented amount. */
export const LIVE_CHAT_SELLER_PAYOUT_HOWTO_REPLY =
  "After the buyer gets the board — tracked delivery plus a day, or a verified pickup — earnings land in /dashboard/earnings. Connect a bank there and cash out; standard ACH is usually a couple of business days."

/** This-order lookup when generate could not land. Not a topic catalog. */
export const LIVE_CHAT_ORDER_LOOKUP_FALLBACK =
  "Which order is it — a purchase or a sale?"

/**
 * Unknown / empty generate. Always send this — then open a real staff follow-up.
 * Do not mention the ticket. Do not ask for an order number.
 */
export const LIVE_CHAT_LOOK_INTO_IT_REPLY =
  "I'll look into it now and update you shortly."

export const LIVE_CHAT_NEEDS_FOLLOW_UP_KEY = "needs_human_follow_up"
export const LIVE_CHAT_LOOK_INTO_IT_AT_KEY = "look_into_it_at"

const BUY_HOWTO =
  /\bhow (?:do i|do you|can i|to) buy\b|\bbuy a (?:surf)?board\b|\bhow do i buy\b/i

const ASKS_ORDER_NUMBER =
  /\b(?:what(?:'s| is) the )?order number\b|\bwhich order is it\b|\bpurchase or a sale\b/i

const LOOK_INTO_IT_PROMISE =
  /\bi(?:'ll| will) look into it\b/i

export function isLiveChatLookIntoItReply(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (trimmed === LIVE_CHAT_LOOK_INTO_IT_REPLY) return true
  return LOOK_INTO_IT_PROMISE.test(trimmed) && /\bupdate you shortly\b/i.test(trimmed)
}

export function shouldCreateLiveChatLookIntoItFollowUp(reply: string): boolean {
  return isLiveChatLookIntoItReply(reply)
}

/** Staff-only case note. Never shown to the visitor. */
export function liveChatLookIntoItInternalNote(visitorMessage: string): string {
  const excerpt = visitorMessage.trim().slice(0, 500)
  return excerpt
    ? `Could not answer from published help. Follow up in this chat. Visitor asked: ${excerpt}`
    : "Could not answer from published help. Follow up in this chat."
}

/**
 * Generated text that must not ship as a "success." Auto-reply then sends the
 * intent-aware fallback (how-to / order / look-into-it) instead.
 */
export function isLiveChatGeneratedUngroundedReply(
  body: string,
  visitorMessage: string,
): boolean {
  const trimmed = body.trim()
  if (!trimmed) return true
  if (isLiveChatLookIntoItReply(trimmed)) return true
  if (
    ASKS_ORDER_NUMBER.test(trimmed) &&
    !isLiveChatSpecificOrderLookupIntent(visitorMessage) &&
    !liveChatMessageNamesOrder(visitorMessage)
  ) {
    return true
  }
  return false
}

export function resolveLiveChatFallbackReply(visitorMessage: string): string {
  if (isLiveChatPresenceIntent(visitorMessage)) return LIVE_CHAT_PRESENCE_REPLY
  if (isLiveChatSellerPayoutHowtoIntent(visitorMessage)) {
    return LIVE_CHAT_SELLER_PAYOUT_HOWTO_REPLY
  }
  if (isLiveChatMarketplaceHowtoIntent(visitorMessage)) {
    if (BUY_HOWTO.test(visitorMessage)) return LIVE_CHAT_BUY_HOWTO_REPLY
    return LIVE_CHAT_LOOK_INTO_IT_REPLY
  }
  if (isLiveChatSpecificOrderLookupIntent(visitorMessage)) {
    return LIVE_CHAT_ORDER_LOOKUP_FALLBACK
  }
  return LIVE_CHAT_LOOK_INTO_IT_REPLY
}
