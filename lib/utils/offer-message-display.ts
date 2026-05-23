import type { OfferRowLite } from "@/components/features/messages/seller-offer-response-dialog"
import { parseCounterofferNoteFromThread } from "@/lib/utils/parse-offer-negotiation-message"

function parseMoney(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

export type OfferMessageDisplay = {
  headline: string
  amount: string
  contextLine?: string
  note?: string
}

/** Structured copy for offer cards in message threads — avoids raw mirrored prefixes. */
export function buildOfferMessageDisplay(
  offer: OfferRowLite,
  messageContent: string,
  isSeller: boolean,
): OfferMessageDisplay {
  const current = parseMoney(offer.current_amount)
  const initial = parseMoney(offer.initial_amount ?? offer.current_amount)
  const note = parseCounterofferNoteFromThread(messageContent) ?? undefined
  const amount = `$${current.toFixed(2)}`
  const sellerInitiated = !!offer.seller_initiated

  switch (offer.status) {
    case "PENDING":
      return {
        headline: isSeller ? "New offer from buyer" : "Your offer",
        amount,
        note,
      }
    case "COUNTERED":
      if (sellerInitiated) {
        return {
          headline: isSeller ? "Your offer to buyer" : "Offer from seller",
          amount,
          note,
        }
      }
      return {
        headline: isSeller ? "Your counteroffer" : "Seller counteroffer",
        amount,
        contextLine: initial !== current ? `Buyer offered $${initial.toFixed(2)}` : undefined,
        note,
      }
    case "ACCEPTED":
      return {
        headline: "Offer accepted",
        amount,
        note,
      }
    case "DECLINED":
      return {
        headline: "Offer declined",
        amount,
        note,
      }
    case "EXPIRED":
      return {
        headline: "Offer expired",
        amount,
        note,
      }
    case "WITHDRAWN":
      return {
        headline: "Offer withdrawn",
        amount,
        note,
      }
    case "COMPLETED":
      return {
        headline: "Purchase completed",
        amount,
        note,
      }
    default:
      return {
        headline: "Offer update",
        amount,
        note,
      }
  }
}
