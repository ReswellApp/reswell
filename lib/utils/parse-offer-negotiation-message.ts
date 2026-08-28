/**
 * Detects system negotiation lines appended by offer services (plain `messages` rows, no `offer_id`).
 * Keep in sync with strings in `lib/services/respondToOffer.ts`, `createSellerInitiatedOffer.ts`, and `respondToCounterOffer.ts`.
 */
import { openingOfferNoteFromTimeline } from "@/lib/utils/offer-timeline"

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

/** Prefer mirrored thread text; fall back to structured `offer_timeline` note. */
export function resolveOfferThreadNote(
  messageContent: string,
  offerTimeline?: unknown,
  options?: { sellerInitiated?: boolean },
): string | null {
  const fromContent = parseCounterofferNoteFromThread(messageContent)
  if (fromContent) return fromContent
  if (offerTimeline === undefined) return null
  return openingOfferNoteFromTimeline(offerTimeline, options)
}

function parseMoneyLoose(v: unknown): number | null {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/,/g, ""))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

/** Dollar amount from a mirrored negotiation thread line (offer, counter, accept). */
export function parseNegotiationAmountFromContent(content: string): number | null {
  const t = content.trim()
  const patterns = [
    /^Counteroffer:\s*\$([\d,]+(?:\.\d{2})?)/i,
    /^Offer from seller:\s*\$([\d,]+(?:\.\d{2})?)/i,
    /^(?:Counteroffer|Offer) accepted\s*[—–-]\s*\$([\d,]+(?:\.\d{2})?)/i,
    /^(?:Counteroffer|Offer) declined\s*[—–-]\s*(?:seller asked\s*)?\$([\d,]+(?:\.\d{2})?)/i,
  ] as const
  for (const pattern of patterns) {
    const m = pattern.exec(t)
    if (m?.[1]) return parseMoneyLoose(m[1])
  }
  return null
}

type OfferLikeForNegotiation = {
  id: string
  status: string
  current_amount: number | string
  listing_id?: string
  seller_initiated?: boolean | null
  expires_at?: string | null
  line_items?: unknown
}

function matchOfferByAmountAndListing(
  offers: OfferLikeForNegotiation[],
  content: string,
  listingId: string | null | undefined,
): OfferLikeForNegotiation | null {
  const amount = parseNegotiationAmountFromContent(content)

  if (amount != null) {
    const amountMatch = offers.find((o) => {
      if (listingId && o.listing_id && o.listing_id !== listingId) return false
      const current = parseMoneyLoose(o.current_amount)
      return current != null && Math.abs(current - amount) <= 0.001
    })
    if (amountMatch) return amountMatch
  }

  const onListing = listingId
    ? offers.filter((o) => !o.listing_id || o.listing_id === listingId)
    : offers
  return onListing.length === 1 ? onListing[0]! : null
}

/**
 * Match a mirrored counter / seller-offer line to an open COUNTERED offer so the
 * latest thread card can show Accept / Decline.
 */
export function resolveActionableCounteredOffer(
  offers: OfferLikeForNegotiation[],
  kind: OfferNegotiationKind,
  content: string,
  listingId: string | null | undefined,
): OfferLikeForNegotiation | null {
  if (kind !== "counter" && kind !== "seller_offer") return null

  const now = Date.now()

  const open = offers.filter((o) => {
    if (o.status !== "COUNTERED") return false
    if (kind === "seller_offer" && !o.seller_initiated) return false
    if (kind === "counter" && o.seller_initiated) return false
    if (listingId && o.listing_id && o.listing_id !== listingId) return false
    if (o.expires_at) {
      const exp = new Date(o.expires_at).getTime()
      if (Number.isFinite(exp) && exp <= now) return false
    }
    return true
  })

  return matchOfferByAmountAndListing(open, content, listingId)
}

/**
 * Match a mirrored accept line to an ACCEPTED offer so the latest thread card
 * can show Checkout.
 */
export function resolveAcceptedOfferForCheckout(
  offers: OfferLikeForNegotiation[],
  kind: OfferNegotiationKind,
  content: string,
  listingId: string | null | undefined,
): OfferLikeForNegotiation | null {
  if (kind !== "accepted") return null

  const accepted = offers.filter((o) => {
    if (o.status !== "ACCEPTED") return false
    if (listingId && o.listing_id && o.listing_id !== listingId) return false
    return true
  })

  return matchOfferByAmountAndListing(accepted, content, listingId)
}
