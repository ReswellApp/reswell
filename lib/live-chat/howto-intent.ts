/**
 * Marketplace how-tos vs this-visitor lookups.
 * Generic "I sold a board, how do I get paid?" is published policy — not an order lookup.
 * Buyer payment / refund phrasing is not a seller cash-out.
 */

const BUYER_PAYOUT_LOOKALIKE =
  /\b(refunds?|money back|returns?|returning|purchase protection|bought|buy(?:ing)?|purchase[ds]?|(?<!get\s)paid for|how(?:\s+\w+){0,8}\s+pay(?:ment|ing)?\b|when(?:\s+\w+){0,8}\s+pay(?:ment|ing)?\b)\b/i

const SELLER_PAYOUT_HOWTO =
  /\b(cash(?:\s*|-)?outs?|withdraw(?:al|ing)?s?|payouts?|earnings|get(?:ting)?\s+paid|how(?:\s+\w+){0,8}\s+(?:payout|earnings)|when(?:\s+\w+){0,8}\s+(?:payout|earnings))\b/i

const SELLER_CONTEXT =
  /\b(sold|sell(?:ing)?|sale|seller|earnings|payouts?|cash(?:\s*|-)?outs?)\b/i

const MONEY_ASK =
  /\b(get(?:ting)?(?:\s+my)?\s+(?:money|paid|payout)|how(?:\s+\w+){0,8}\s+(?:paid|money)|when(?:\s+\w+){0,8}\s+(?:paid|money)|money)\b/i

const SPECIFIC_PAYOUT_LOOKUP =
  /\b(order\s*#?\s*\d|where(?:'s| is) my (?:payout|money|earnings)|still (?:pending|waiting|held)|hasn'?t (?:released|arrived|shown)|this (?:sale|order)|my sale|stuck)\b/i

export const LIVE_CHAT_DEFAULT_PINNED_HELP_SLUGS = [
  "purchase-protection-claim",
  "seller-returns",
  "package-delayed-or-lost",
] as const

export const LIVE_CHAT_SELLER_PAYOUT_HELP_SLUGS = [
  "how-long-to-get-paid",
  "how-cash-outs-work",
  "i-sold-an-item-whats-next",
] as const

export function isLiveChatSellerPayoutHowtoIntent(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (SPECIFIC_PAYOUT_LOOKUP.test(trimmed)) return false
  if (BUYER_PAYOUT_LOOKALIKE.test(trimmed)) return false
  if (SELLER_PAYOUT_HOWTO.test(trimmed)) return true
  return SELLER_CONTEXT.test(trimmed) && MONEY_ASK.test(trimmed)
}

export function liveChatPinnedHelpSlugs(query: string): string[] {
  if (isLiveChatSellerPayoutHowtoIntent(query)) {
    return [...LIVE_CHAT_SELLER_PAYOUT_HELP_SLUGS]
  }
  return [...LIVE_CHAT_DEFAULT_PINNED_HELP_SLUGS]
}
