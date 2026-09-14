/** Buyer offers that are still in negotiation on a listing. */
export const LISTING_BUYER_OPEN_OFFER_STATUSES = ["PENDING", "COUNTERED"] as const

/** Stable lookup key for a listing-scoped buyer↔seller thread. */
export function offerConversationKey(
  listingId: string,
  buyerId: string,
  sellerId: string,
): string {
  return `${listingId}:${buyerId}:${sellerId}`
}

export function offerMessageAnchorId(offerId: string): string {
  return `offer-${offerId}`
}

export type ConversationOfferKeyRow = {
  id: string
  listing_id: string | null
  buyer_id: string
  seller_id: string
}

/** Maps listing-scoped threads to the same key used by offer tiles. */
export function conversationRowsToOfferKeyMap(
  rows: ConversationOfferKeyRow[],
): Record<string, string> {
  const next: Record<string, string> = {}
  for (const row of rows) {
    const listingId = row.listing_id
    if (!listingId) continue
    next[offerConversationKey(listingId, row.buyer_id, row.seller_id)] = row.id
  }
  return next
}

export function offerMessagesHref(
  offer: { id?: string; listing_id: string; buyer_id: string; seller_id: string },
  role: "buyer" | "seller",
  conversationId?: string | null,
): string {
  if (conversationId) {
    const path = `/messages/${conversationId}`
    return offer.id ? `${path}#${offerMessageAnchorId(offer.id)}` : path
  }
  const otherId = role === "buyer" ? offer.seller_id : offer.buyer_id
  const params = new URLSearchParams({
    user: otherId,
    listing: offer.listing_id,
  })
  if (offer.id) params.set("offer", offer.id)
  return `/messages/new?${params.toString()}`
}
