/**
 * Detects system negotiation lines appended by offer services (plain `messages` rows, no `offer_id`).
 * Keep in sync with strings in `lib/services/respondToOffer.ts`, `createSellerInitiatedOffer.ts`, and `respondToCounterOffer.ts`.
 */
export type OfferNegotiationKind = "declined" | "accepted" | "counter" | "seller_offer"

export function parseOfferNegotiationMessage(content: string): OfferNegotiationKind | null {
  const t = content.trim()
  if (t.startsWith("Offer declined") || t.startsWith("Counteroffer declined")) return "declined"
  if (t.startsWith("Offer accepted") || t.startsWith("Counteroffer accepted")) return "accepted"
  if (t.startsWith("Offer from seller:")) return "seller_offer"
  if (t.startsWith("Counteroffer:")) return "counter"
  return null
}

const THREAD_NOTE_PATTERNS = [
  /^Offer from seller:\s*\$[\d,]+(?:\.\d{2})?\s*[—–-]\s*(.+)$/i,
  /^Counteroffer:\s*\$[\d,]+(?:\.\d{2})?\s*[—–-]\s*(.+)$/i,
  /^Offer:\s*\$[\d,]+(?:\.\d{2})?\s*[—–-]\s*(.+)$/i,
] as const

/** Note segment after an em dash on mirrored offer/counter lines (thread cards). */
export function parseCounterofferNoteFromThread(content: string): string | null {
  const t = content.trim()
  for (const pattern of THREAD_NOTE_PATTERNS) {
    const m = pattern.exec(t)
    if (m?.[1]) {
      const note = m[1].trim()
      if (note !== "") return note
    }
  }
  return null
}
