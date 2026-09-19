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
  /\b(where(?:'s| is) my (?:order|package|board|shipment|delivery)|track(?:ing)?(?:\s+(?:my|this))?(?:\s+order)?|has (?:it|my order) shipped|when will (?:it|my (?:order|board|package)) (?:arrive|get here)|shipped yet|delivery status|status of my (?:order|sale|purchase)|check (?:on )?(?:my |this )?(?:order|sale|purchase))\b/i

const REFUND_LOOKUP =
  /\b(i want (?:a )?refund|refund (?:this|my|the)|money back|return this|cancel (?:this|my) (?:order|purchase)|never arrived|arrived damaged|wrong (?:item|board)|not as (?:described|listed)|purchase protection claim)\b/i

export function liveChatMessageNamesOrder(text: string): boolean {
  return NAMED_ORDER.test(text.trim())
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
export function liveChatOrderTileClickMessage(orderNum: string): string {
  const trimmed = orderNum.trim().replace(/^#+\s*/, "")
  return `It's order #${trimmed}`
}
