/**
 * When to show tap-to-pick order tiles in live chat.
 * Specific this-visitor lookups only — not marketplace how-tos, not label-update.
 */

import { isLiveChatShipFromLabelUpdateIntent } from "./label-update-intent.ts"

/** Same seller-payout how-to as PR #464 — tiles stay off these asks. */
const SELLER_PAYOUT_HOWTO =
  /\b(get(?:ting)?(?:\s+my)?\s+(?:money|paid|payout)|get paid|cash(?:\s*|-)?outs?|withdraw|how(?:\s+\w+){0,8}\s+(?:paid|pay|money|payout|earnings|cash)|when(?:\s+\w+){0,8}\s+(?:paid|pay|money|payout|earnings)|sold.{0,80}(?:money|paid|payout|earnings|cash(?:\s*|-)?outs?)|(?:money|paid|payout|earnings).{0,40}(?:sold|sale|board))\b/i

const SPECIFIC_PAYOUT_LOOKUP =
  /\b(order\s*#?\s*\d|where(?:'s| is) my (?:payout|money|earnings)|still (?:pending|waiting|held)|hasn'?t (?:released|arrived|shown)|this (?:sale|order)|my sale|stuck)\b/i

const POLICY_HOWTO =
  /\b(refund policy|return policy|purchase protection coverage|how (?:do|does) (?:refunds?|returns?|shipping|fees?|payouts?|cash(?:\s*|-)outs?|purchase protection) work|how (?:do i|do you|can i|to) (?:buy|sell|list|checkout|sign in))\b/i

const NAMED_ORDER =
  /\b(?:it'?s\s+)?(?:order|sale|purchase)\s*#?\s*[A-Z0-9]{3,}\b|#\s*[A-Z0-9]{3,}\b/i

const TRACKING_LOOKUP =
  /\b(where(?:'s| is) my (?:order|package|board|shipment|delivery|purchase|sale)|track(?:ing)?(?:\s+(?:my|this))?(?:\s+order)?|has (?:it|my order) shipped|when will (?:it|my (?:order|board|package)) (?:arrive|get here)|shipped yet|delivery status|status of my (?:order|sale|purchase)|check (?:on )?(?:my |this )?(?:order|sale|purchase))\b/i

const REFUND_LOOKUP =
  /\b(i want (?:a )?refund|refund (?:this|my|the)|money back|return this|cancel (?:this|my) (?:order|purchase)|never arrived|arrived damaged|wrong (?:item|board)|not as (?:described|listed)|purchase protection claim)\b/i

export type LiveChatOrderRole = "buyer" | "seller"

const BUYER_ROLE =
  /\b(bought|buy(?:ing)?|purchase[ds]?|my purchase|this purchase|refund|money back|return this|never arrived|arrived damaged|purchase protection|cancel (?:this|my) (?:order|purchase)|where(?:'s| is) my (?:package|delivery))\b/i

const SELLER_ROLE =
  /\b(sold|sell(?:ing)?|my sale|this sale|payout|earnings|get paid|the buyer)\b/i

export function liveChatMessageNamesOrder(text: string): boolean {
  return NAMED_ORDER.test(text.trim())
}

/** Infer purchase vs sale from the visitor's ask. Null means ask. */
export function liveChatOrderLookupRole(text: string): LiveChatOrderRole | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const buyer = BUYER_ROLE.test(trimmed)
  const seller = SELLER_ROLE.test(trimmed)
  if (buyer && !seller) return "buyer"
  if (seller && !buyer) return "seller"
  return null
}

/** Role to show tiles for, or null when the widget should ask bought vs sold. */
export function resolveLiveChatOrderTileRole(input: {
  orders: Array<{ role: LiveChatOrderRole }>
  inferredRole: LiveChatOrderRole | null
}): LiveChatOrderRole | null {
  const hasBuyer = input.orders.some((order) => order.role === "buyer")
  const hasSeller = input.orders.some((order) => order.role === "seller")
  if (hasBuyer && !hasSeller) return "buyer"
  if (hasSeller && !hasBuyer) return "seller"
  if (input.inferredRole === "buyer" && hasBuyer) return "buyer"
  if (input.inferredRole === "seller" && hasSeller) return "seller"
  return null
}

export function isLiveChatMarketplaceHowtoIntent(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (POLICY_HOWTO.test(trimmed)) return true
  if (SPECIFIC_PAYOUT_LOOKUP.test(trimmed)) return false
  if (SELLER_PAYOUT_HOWTO.test(trimmed)) return true
  return /\bsold\b/i.test(trimmed) && /\b(money|paid|pay|payout|earnings|cash(?:\s*|-)?out)\b/i.test(trimmed)
}

export function isLiveChatSpecificOrderLookupIntent(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (isLiveChatShipFromLabelUpdateIntent(trimmed)) return false
  if (liveChatMessageNamesOrder(trimmed)) return false
  if (isLiveChatMarketplaceHowtoIntent(trimmed)) return false
  if (TRACKING_LOOKUP.test(trimmed)) return true
  if (REFUND_LOOKUP.test(trimmed)) return true
  if (SPECIFIC_PAYOUT_LOOKUP.test(trimmed)) return true
  if (/\brefunds?\b/i.test(trimmed) && !/\bhow\b/i.test(trimmed)) return true
  return false
}

/**
 * Latest visitor message that needs a this-order lookup.
 * Returns null once a later non-lookup visitor message appears.
 */
export function latestLiveChatSpecificOrderLookupMessage(
  messages: Array<{ id: string; sender_type: string; content: string }>,
): { id: string; content: string } | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (!message || message.sender_type !== "visitor") continue
    if (isLiveChatSpecificOrderLookupIntent(message.content)) {
      return { id: message.id, content: message.content }
    }
    if (message.content.trim()) return null
  }
  return null
}

/** Visitor message sent when they tap an order tile. */
export function liveChatOrderTileClickMessage(
  orderNum: string,
  role?: LiveChatOrderRole,
): string {
  const trimmed = orderNum.trim().replace(/^#+\s*/, "")
  if (role === "buyer") return `It's purchase #${trimmed}`
  if (role === "seller") return `It's sale #${trimmed}`
  return `It's order #${trimmed}`
}

export function liveChatOrderTileReplyForOrders(
  orders: Array<{ role: LiveChatOrderRole }>,
  lookupText: string,
): string {
  const role = resolveLiveChatOrderTileRole({
    orders,
    inferredRole: liveChatOrderLookupRole(lookupText),
  })
  if (!role) return "Was it something you bought or sold? Tap one and I'll pull up those orders."
  if (role === "buyer") return "Tap the purchase below and I'll look that one up."
  return "Tap the sale below and I'll look that one up."
}
