/**
 * Marketplace how-tos vs this-visitor lookups.
 * Generic "I sold a board, how do I get paid?" is published policy — not an order lookup.
 */

const SELLER_PAYOUT_HOWTO =
  /\b(cash(?:\s*|-)?outs?|withdraw|how(?:\s+\w+){0,8}\s+(?:payout|earnings)|when(?:\s+\w+){0,8}\s+(?:payout|earnings)|sold.{0,80}(?:money|paid|payout|earnings|cash(?:\s*|-)?outs?))\b/i

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
  if (SELLER_PAYOUT_HOWTO.test(trimmed)) return true
  return /\bsold\b/i.test(trimmed) && /\b(money|paid|pay|payout|earnings|cash(?:\s*|-)?out)\b/i.test(trimmed)
}

export function liveChatPinnedHelpSlugs(query: string): string[] {
  if (isLiveChatSellerPayoutHowtoIntent(query)) {
    return [...LIVE_CHAT_SELLER_PAYOUT_HELP_SLUGS]
  }
  return [...LIVE_CHAT_DEFAULT_PINNED_HELP_SLUGS]
}
