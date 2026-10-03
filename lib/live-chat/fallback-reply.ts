/**
 * Intent-aware auto-reply when generate is empty, off, times out, or skipped.
 * Presence pings never get a topic catalog. How-tos get a published next step.
 */

import { MARKETPLACE_FEE_PERCENT, SELLER_SHARE_PERCENT } from "../seller-fees.ts"
import { SHIPPING_DEADLINE_DAYS } from "../shipping-deadline.ts"
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

/** Published sell / list how-to — listing is free. */
export const LIVE_CHAT_SELL_HOWTO_REPLY =
  "Tap Sell, pick a category, add photos and details, choose pickup and/or shipping, set your price, and create the listing. Listing is free — Reswell takes a fee only when a sale completes."

/** Published marketplace-fee how-to. */
export const LIVE_CHAT_FEES_HOWTO_REPLY = `Listing is free. On a completed sale Reswell takes ${MARKETPLACE_FEE_PERCENT}% of the item price — you keep ${SELLER_SHARE_PERCENT}%. Buyer-paid shipping is not fee'd, and card processing is absorbed by Reswell.`

/** Published shipping-rules how-to — buyer listing options and seller window. */
export const LIVE_CHAT_SHIPPING_HOWTO_REPLY = `Pickup or shipping is on each listing — choose at checkout if both are offered. Sellers ship within ${SHIPPING_DEADLINE_DAYS} days and add tracking on the sale. Purchase Protection needs tracked shipping; local pickup is not covered.`

/** Published refund / return policy how-to. */
export const LIVE_CHAT_REFUND_POLICY_HOWTO_REPLY =
  "For covered problems on shipped orders, open the purchase and tap Get help — or file a Purchase Protection claim. Qualifying U.S. returns start within 7 days of delivery. There are no exchanges."

/** Published Purchase Protection coverage how-to. */
export const LIVE_CHAT_PROTECTION_HOWTO_REPLY =
  "Purchase Protection is included on eligible checkout purchases. It covers never arrives (tracked), arrives damaged, or isn't what was listed. Local pickup and off-platform payments aren't covered. File from Get help within 30 days of delivery."

/** Sign-in how-to — not a presence ping. */
export const LIVE_CHAT_SIGN_IN_HOWTO_REPLY =
  "Use the sign-in screen — reset your password there if you're locked out. You need to be signed in to buy, list, or see your orders."

/** Marketplace how-to we could not specialize — still a published next step, never presence. */
export const LIVE_CHAT_MARKETPLACE_HOWTO_FALLBACK =
  "That's covered in /help. What's the exact step you're stuck on?"

/** Published seller-payout how-to — no order number, no invented amount. */
export const LIVE_CHAT_SELLER_PAYOUT_HOWTO_REPLY =
  "After the buyer gets the board — tracked delivery plus a day, or a verified pickup — earnings land in /dashboard/earnings. Connect a bank there and cash out; standard ACH is usually a couple of business days."

/** This-order lookup when generate could not land. Not a topic catalog. */
export const LIVE_CHAT_ORDER_LOOKUP_FALLBACK =
  "Which order is it — a purchase or a sale?"

const BUY_HOWTO =
  /\bhow (?:do i|do you|can i|to) (?:buy|checkout)\b|\bbuy a (?:surf)?board\b|\bhow do i buy\b|\bhow (?:do|does) checkout work\b/i

const SELL_LIST_HOWTO = /\bhow (?:do i|do you|can i|to) (?:sell|list)\b/i

const FEES_HOWTO = /\bhow (?:do|does) fees? work\b|\bmarketplace fees?\b/i

const SHIPPING_HOWTO = /\bhow (?:do|does) shipping work\b/i

const REFUND_POLICY_HOWTO =
  /\b(?:refund|return) policy\b|\bhow (?:do|does) (?:refunds?|returns?) work\b/i

const PROTECTION_HOWTO =
  /\bpurchase protection coverage\b|\bhow (?:do|does) purchase protection work\b/i

const SIGN_IN_HOWTO = /\bhow (?:do i|do you|can i|to) sign in\b/i

function resolveLiveChatMarketplaceHowtoFallback(visitorMessage: string): string {
  if (BUY_HOWTO.test(visitorMessage)) return LIVE_CHAT_BUY_HOWTO_REPLY
  if (FEES_HOWTO.test(visitorMessage)) return LIVE_CHAT_FEES_HOWTO_REPLY
  if (PROTECTION_HOWTO.test(visitorMessage)) return LIVE_CHAT_PROTECTION_HOWTO_REPLY
  if (REFUND_POLICY_HOWTO.test(visitorMessage)) return LIVE_CHAT_REFUND_POLICY_HOWTO_REPLY
  if (SHIPPING_HOWTO.test(visitorMessage)) return LIVE_CHAT_SHIPPING_HOWTO_REPLY
  if (SELL_LIST_HOWTO.test(visitorMessage)) return LIVE_CHAT_SELL_HOWTO_REPLY
  if (SIGN_IN_HOWTO.test(visitorMessage)) return LIVE_CHAT_SIGN_IN_HOWTO_REPLY
  return LIVE_CHAT_MARKETPLACE_HOWTO_FALLBACK
}

export function resolveLiveChatFallbackReply(visitorMessage: string): string {
  if (isLiveChatPresenceIntent(visitorMessage)) return LIVE_CHAT_PRESENCE_REPLY
  if (isLiveChatSellerPayoutHowtoIntent(visitorMessage)) {
    return LIVE_CHAT_SELLER_PAYOUT_HOWTO_REPLY
  }
  if (isLiveChatMarketplaceHowtoIntent(visitorMessage)) {
    return resolveLiveChatMarketplaceHowtoFallback(visitorMessage)
  }
  if (
    isLiveChatSpecificOrderLookupIntent(visitorMessage) ||
    liveChatMessageNamesOrder(visitorMessage)
  ) {
    return LIVE_CHAT_ORDER_LOOKUP_FALLBACK
  }
  return LIVE_CHAT_PRESENCE_REPLY
}
