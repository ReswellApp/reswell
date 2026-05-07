/**
 * Detects system negotiation lines appended by offer services (plain `messages` rows, no `offer_id`).
 * Keep in sync with strings in `lib/services/respondToOffer.ts` and `lib/services/respondToCounterOffer.ts`.
 */
export type OfferNegotiationKind = "declined" | "accepted" | "counter"

export function parseOfferNegotiationMessage(content: string): OfferNegotiationKind | null {
  const t = content.trim()
  if (t.startsWith("Offer declined") || t.startsWith("Counteroffer declined")) return "declined"
  if (t.startsWith("Offer accepted") || t.startsWith("Counteroffer accepted")) return "accepted"
  if (t.startsWith("Counteroffer:")) return "counter"
  return null
}

/** Note segment after an em dash on mirrored counteroffer lines (buyer thread cards). */
export function parseCounterofferNoteFromThread(content: string): string | null {
  const t = content.trim()
  const m = /^Counteroffer:\s*\$[\d,]+(?:\.\d{2})?\s*[—–-]\s*(.+)$/i.exec(t)
  if (!m?.[1]) return null
  const note = m[1].trim()
  return note !== "" ? note : null
}
