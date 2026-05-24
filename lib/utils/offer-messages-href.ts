/** Stable lookup key for a listing-scoped buyer↔seller thread. */
export function offerConversationKey(
  listingId: string,
  buyerId: string,
  sellerId: string,
): string {
  return `${listingId}:${buyerId}:${sellerId}`
}

export function offerMessagesHref(
  offer: { listing_id: string; buyer_id: string; seller_id: string },
  role: "buyer" | "seller",
  conversationId?: string | null,
): string {
  if (conversationId) return `/messages/${conversationId}`
  const otherId = role === "buyer" ? offer.seller_id : offer.buyer_id
  return `/messages/new?user=${otherId}&listing=${offer.listing_id}`
}
