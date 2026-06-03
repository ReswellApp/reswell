export type SellerDirectoryRankInput = {
  id: string
  sales_count: number | null
  inventoryCount: number
}

/** Primary: most sales. Secondary: most active inventory. */
export function compareSellersBySalesThenInventory(
  a: SellerDirectoryRankInput,
  b: SellerDirectoryRankInput,
): number {
  const salesA = a.sales_count ?? 0
  const salesB = b.sales_count ?? 0
  if (salesB !== salesA) return salesB - salesA
  return b.inventoryCount - a.inventoryCount
}

/**
 * Admin demotions sink profiles to the bottom without hiding them.
 * Non-demoted order comes from `compareSellersBySalesThenInventory`.
 */
export function orderSellersWithDemotions<T extends { id: string }>(
  shops: T[],
  demotedOrder: string[],
  rankInput: (shop: T) => SellerDirectoryRankInput,
): T[] {
  const ranked = [...shops].sort((a, b) =>
    compareSellersBySalesThenInventory(rankInput(a), rankInput(b)),
  )

  if (demotedOrder.length === 0) return ranked

  const demotedSet = new Set(demotedOrder)
  const demotedRank = new Map(demotedOrder.map((id, i) => [id, i]))

  return [...ranked].sort((a, b) => {
    const aDemoted = demotedSet.has(a.id)
    const bDemoted = demotedSet.has(b.id)
    if (aDemoted !== bDemoted) return aDemoted ? 1 : -1
    if (aDemoted && bDemoted) {
      return (demotedRank.get(a.id) ?? 0) - (demotedRank.get(b.id) ?? 0)
    }
    return compareSellersBySalesThenInventory(rankInput(a), rankInput(b))
  })
}

export function buildInventoryCountBySeller(
  listingRows: { user_id: string }[] | null | undefined,
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of listingRows ?? []) {
    const uid = row.user_id
    counts.set(uid, (counts.get(uid) ?? 0) + 1)
  }
  return counts
}
