/**
 * Intent-aware auto-reply when generate is empty, off, times out, or skipped.
 * Presence pings never get a topic catalog. How-tos get a published next step.
 */

import { isLiveChatPresenceIntent } from "./greeting-intent.ts"
import { isLiveChatSellerPayoutHowtoIntent } from "./howto-intent.ts"
import {
  isLiveChatMarketplaceHowtoIntent,
  isLiveChatSpecificOrderLookupIntent,
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

const BUY_HOWTO =
  /\bhow (?:do i|do you|can i|to) buy\b|\bbuy a (?:surf)?board\b|\bhow do i buy\b/i

export function resolveLiveChatFallbackReply(visitorMessage: string): string {
  if (isLiveChatPresenceIntent(visitorMessage)) return LIVE_CHAT_PRESENCE_REPLY
  if (isLiveChatSellerPayoutHowtoIntent(visitorMessage)) {
    return LIVE_CHAT_SELLER_PAYOUT_HOWTO_REPLY
  }
  if (isLiveChatMarketplaceHowtoIntent(visitorMessage)) {
    if (BUY_HOWTO.test(visitorMessage)) return LIVE_CHAT_BUY_HOWTO_REPLY
    return LIVE_CHAT_PRESENCE_REPLY
  }
  if (isLiveChatSpecificOrderLookupIntent(visitorMessage)) {
    return LIVE_CHAT_ORDER_LOOKUP_FALLBACK
  }
  return LIVE_CHAT_PRESENCE_REPLY
}
