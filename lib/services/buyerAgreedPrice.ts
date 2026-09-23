type AcceptedOfferPricing = {
  seller_id: string
  current_amount: string | number
}

export function buyerAgreedPriceUsdFromOffer(
  offer: AcceptedOfferPricing | null,
  sellerId: string,
): number | null {
  if (!offer || offer.seller_id !== sellerId) return null
  const amount = Math.round(parseFloat(String(offer.current_amount)) * 100) / 100
  if (!Number.isFinite(amount) || amount <= 0) return null
  return amount
}
