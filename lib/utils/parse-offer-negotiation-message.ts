/**
 * Detects system negotiation lines appended by `respondToOffer` (plain `messages` rows, no `offer_id`).
 * Keep in sync with strings in `lib/services/respondToOffer.ts`.
 */
export type OfferNegotiationKind = "declined" | "accepted" | "counter"

export function parseOfferNegotiationMessage(content: string): OfferNegotiationKind | null {
  const t = content.trim()
  if (t.startsWith("Offer declined")) return "declined"
  if (t.startsWith("Offer accepted")) return "accepted"
  if (t.startsWith("Counteroffer:")) return "counter"
  return null
}
