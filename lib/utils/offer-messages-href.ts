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
  return `/messages/new?user=${otherId}&listing=${offer.listing_id}`
}
