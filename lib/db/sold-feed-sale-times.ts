/** One confirmed checkout line on the public /sold feed. */
export type SoldFeedSaleRef = {
  listingId: string
  orderId: string
  saleConfirmedAt: string
}

export function soldFeedEntryKey(listingId: string, orderId: string): string {
  return `${listingId}:${orderId}`
}

export function soldFeedSaleRefFromRpcRow(row: {
  listing_id?: string | null
  order_id?: string | null
  sale_confirmed_at?: string | null
}): SoldFeedSaleRef | null {
  const listingId = row.listing_id
  const saleConfirmedAt = row.sale_confirmed_at
  if (typeof listingId !== "string" || !listingId) return null
  if (typeof saleConfirmedAt !== "string" || !saleConfirmedAt) return null

  const orderId =
    typeof row.order_id === "string" && row.order_id.trim()
      ? row.order_id.trim()
      : soldFeedEntryKey(listingId, saleConfirmedAt)

  return {
    listingId,
    orderId,
    saleConfirmedAt,
  }
}
