export type SellerOfferConflictRow = {
  id: string
  listingId: string
  status: string
  sellerInitiated: boolean
  lineItemListingIds: string[]
  updatedAt: string
}

export type SellerOfferConflictPlan =
  | { kind: "clear" }
  | { kind: "blocked"; listingId: string }
  | { kind: "replace"; keepId: string; dropIds: string[] }

export function listingIdsOnOffer(row: SellerOfferConflictRow): string[] {
  return [...new Set([row.listingId, ...row.lineItemListingIds].filter((id) => id.length > 0))]
}

export function lineItemListingIdsFromRaw(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const ids: string[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const listingId = (item as { listing_id?: unknown }).listing_id
    if (typeof listingId === "string" && listingId.length > 0) ids.push(listingId)
  }
  return ids
}

/**
 * A new seller offer may replace an open seller-initiated offer on the same listings.
 * A buyer’s pending offer or a counter on a buyer offer stays in place.
 */
export function planSellerOfferRevision(
  rows: SellerOfferConflictRow[],
  nextListingIds: string[],
): SellerOfferConflictPlan {
  const next = new Set(nextListingIds)
  const overlapping = rows.filter((row) =>
    listingIdsOnOffer(row).some((id) => next.has(id)),
  )

  const buyerNegotiation = overlapping.find(
    (row) => !row.sellerInitiated || row.status !== "COUNTERED",
  )
  if (buyerNegotiation) {
    const listingId =
      listingIdsOnOffer(buyerNegotiation).find((id) => next.has(id)) ??
      buyerNegotiation.listingId
    return { kind: "blocked", listingId }
  }

  const sellerOffers = overlapping.filter(
    (row) => row.sellerInitiated && row.status === "COUNTERED",
  )
  if (sellerOffers.length === 0) return { kind: "clear" }

  const sorted = [...sellerOffers].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
  const keep = sorted[0]
  if (!keep) return { kind: "clear" }
  return {
    kind: "replace",
    keepId: keep.id,
    dropIds: sorted.slice(1).map((row) => row.id),
  }
}
