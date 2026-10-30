import type { MobileOffer, MobilePurchaseStatusTone } from "@reswell/api-contract"
import { formatPurchaseDate } from "@/lib/purchase-display"

export type OffersRoleFilter = "all" | "received" | "sent"

const CLOSED_STATUSES = new Set(["DECLINED", "EXPIRED", "WITHDRAWN", "COMPLETED"])

export function offerCountLabel(count: number): string {
  const safe = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0
  return safe === 1 ? "1 offer" : `${safe} offers`
}

export function offerMatchesQuery(item: MobileOffer, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    item.listing_title,
    item.counterparty_name,
    item.amount_label,
    item.status,
    item.note ?? "",
  ]
    .join(" ")
    .toLowerCase()
  return haystack.includes(q)
}

export function offerMatchesRole(item: MobileOffer, filter: OffersRoleFilter): boolean {
  if (filter === "all") return true
  return item.role === filter
}

export function isOfferPastExpiry(item: MobileOffer, nowMs = Date.now()): boolean {
  if (item.status === "EXPIRED") return true
  if (CLOSED_STATUSES.has(item.status) && item.status !== "EXPIRED") return false
  const expMs = new Date(item.expires_at).getTime()
  if (!Number.isFinite(expMs) || expMs > nowMs) return false
  return item.status === "PENDING" || item.status === "COUNTERED" || item.status === "ACCEPTED"
}

/** Seller on a buyer bid, or buyer on a live counter / seller-initiated offer. */
export function offerNeedsAction(item: MobileOffer, nowMs = Date.now()): boolean {
  if (isOfferPastExpiry(item, nowMs)) return false
  if (item.seller_initiated) {
    return item.side === "buyer" && (item.status === "COUNTERED" || item.status === "PENDING")
  }
  if (item.side === "seller" && item.status === "PENDING") return true
  if (item.side === "buyer" && item.status === "COUNTERED") return true
  return false
}

export function offerPartyLine(item: MobileOffer): string {
  return item.role === "sent" ? `to ${item.counterparty_name}` : `from ${item.counterparty_name}`
}

export function offerStatusLabel(item: MobileOffer, nowMs = Date.now()): string {
  if (item.status === "COMPLETED") return "Completed"
  if (isOfferPastExpiry(item, nowMs)) return "Expired"
  if (offerNeedsAction(item, nowMs)) return "Needs you"
  if (
    item.side === "seller" &&
    item.seller_initiated &&
    (item.status === "COUNTERED" || item.status === "PENDING")
  ) {
    return "Offer sent"
  }
  if (item.side === "seller" && item.status === "COUNTERED") return "Waiting on buyer"
  if (item.side === "buyer" && item.status === "PENDING") return "Waiting on seller"
  if (item.status === "ACCEPTED") return item.side === "buyer" ? "Ready to pay" : "Waiting on payment"
  switch (item.status) {
    case "PENDING":
      return "Pending"
    case "COUNTERED":
      return "Countered"
    case "DECLINED":
      return "Declined"
    case "WITHDRAWN":
      return "Withdrawn"
    case "EXPIRED":
      return "Expired"
    default:
      return item.status
  }
}

export function offerStatusTone(item: MobileOffer, nowMs = Date.now()): MobilePurchaseStatusTone {
  if (offerNeedsAction(item, nowMs)) return "warning"
  if (item.status === "COMPLETED") return "success"
  if (item.status === "ACCEPTED" && !isOfferPastExpiry(item, nowMs)) return "success"
  if (item.status === "DECLINED" || item.status === "WITHDRAWN" || isOfferPastExpiry(item, nowMs)) return "danger"
  return "neutral"
}

export function offerExpiresLabel(item: MobileOffer, nowMs = Date.now()): string | null {
  if (item.status === "COMPLETED" || item.status === "DECLINED" || item.status === "WITHDRAWN") return null
  const date = formatPurchaseDate(item.expires_at)
  if (!date) return null
  if (isOfferPastExpiry(item, nowMs)) return `Expired ${date}`
  return `Expires ${date}`
}

export function offerAskingLine(item: MobileOffer): string | null {
  if (item.listing_price_usd <= 0) return null
  if (item.listing_price_label === item.amount_label) return null
  return `Asking ${item.listing_price_label}`
}

export function offerPriorAmountLine(item: MobileOffer): string | null {
  if (item.status !== "COUNTERED") return null
  if (item.seller_initiated) return null
  if (item.initial_amount_label === item.amount_label) return null
  return item.side === "buyer"
    ? `Your offer ${item.initial_amount_label}`
    : `Buyer offer ${item.initial_amount_label}`
}

export function offerThreadHeadline(item: MobileOffer): string {
  switch (item.status) {
    case "PENDING":
      return item.side === "seller" ? "New offer from buyer" : "Your offer"
    case "COUNTERED":
      if (item.seller_initiated) {
        return item.side === "seller" ? "Your offer to buyer" : "Offer from seller"
      }
      return item.side === "seller" ? "Your counteroffer" : "Seller counteroffer"
    case "ACCEPTED":
      return "Offer accepted"
    case "DECLINED":
      return "Offer declined"
    case "EXPIRED":
      return "Offer expired"
    case "WITHDRAWN":
      return "Offer withdrawn"
    case "COMPLETED":
      return "Purchase completed"
    default:
      return "Offer update"
  }
}

export function isOfferThreadBody(body: string): boolean {
  const t = body.trim()
  return (
    t.startsWith("Offer:") ||
    t.startsWith("Offer from seller:") ||
    t.startsWith("Counteroffer:") ||
    t.startsWith("Offer accepted") ||
    t.startsWith("Counteroffer accepted") ||
    t.startsWith("Offer declined") ||
    t.startsWith("Counteroffer declined") ||
    t.startsWith("Offer withdrawn") ||
    t.startsWith("Offer expired")
  )
}

export function parseOfferThreadAmount(body: string): string | null {
  const match = body.trim().match(/\$[\d,]+(?:\.\d{2})?/)
  return match?.[0] ?? null
}

export function offerThreadFallbackTitle(body: string): string {
  const t = body.trim()
  if (t.startsWith("Offer from seller:")) return "Offer from seller"
  if (t.startsWith("Counteroffer:")) return "Seller counteroffer"
  if (t.startsWith("Offer accepted") || t.startsWith("Counteroffer accepted")) return "Offer accepted"
  if (t.startsWith("Offer declined") || t.startsWith("Counteroffer declined")) return "Offer declined"
  if (t.startsWith("Offer withdrawn")) return "Offer withdrawn"
  if (t.startsWith("Offer expired")) return "Offer expired"
  if (t.startsWith("Offer:")) return "Offer"
  return "Offer"
}

export function offerThreadNote(item: MobileOffer, messageBody: string): string | null {
  if (item.note?.trim()) return item.note.trim()
  const t = messageBody.trim()
  const dash = t.search(/[—–-]\s+/)
  if (dash === -1) return null
  const note = t.slice(dash).replace(/^[—–-]\s+/, "").trim()
  return note || null
}

export function offerHint(item: MobileOffer, nowMs = Date.now()): string | null {
  if (isOfferPastExpiry(item, nowMs) || item.status === "COMPLETED") return null
  if (
    item.side === "seller" &&
    item.seller_initiated &&
    (item.status === "COUNTERED" || item.status === "PENDING")
  ) {
    return "Waiting for the buyer to respond."
  }
  if (item.side === "seller" && item.status === "COUNTERED") {
    return "Waiting for the buyer to reply to your counter."
  }
  if (item.side === "seller" && item.status === "ACCEPTED") {
    return "Waiting for the buyer to pay."
  }
  if (item.side === "buyer" && item.status === "ACCEPTED") {
    return "Open the listing to pay at the agreed price."
  }
  return null
}

export function offersFilterEmptyMessage(filter: OffersRoleFilter): string {
  if (filter === "received") return "No offers sent to you yet."
  if (filter === "sent") return "You have not sent any offers yet."
  return "No offers match this filter."
}

export function sortOffers(offers: MobileOffer[]): MobileOffer[] {
  return [...offers].sort((a, b) => {
    const aNeed = offerNeedsAction(a) ? 0 : 1
    const bNeed = offerNeedsAction(b) ? 0 : 1
    if (aNeed !== bNeed) return aNeed - bNeed
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })
}
