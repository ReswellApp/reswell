/** Whether a sold tile should say how many units sold in that checkout. */
export function soldFeedShowsSaleQuantity(input: {
  quantity: number
  listingStillInStock: boolean
}): boolean {
  const count = Math.floor(input.quantity)
  if (!Number.isFinite(count) || count < 1) return false
  if (count > 1) return true
  return input.listingStillInStock
}

/**
 * Price line for a sold tile.
 * Multi-unit checkouts use the line total in `soldPriceUsd`.
 */
export function soldFeedSalePriceLabel(
  quantity: number,
  soldPriceUsd: number,
  showQuantity: boolean,
): string {
  const count = Math.max(1, Math.floor(quantity) || 1)
  const amount = soldPriceUsd.toFixed(2)
  if (showQuantity) return `Sold ${count} for $${amount}`
  return `Sold for $${amount}`
}

/** Amount shown on the tile. Quantity sales use what that checkout paid for the units. */
export function soldFeedTilePrice(
  unitPrice: number,
  quantity: number,
  lineTotal: number | null,
): number {
  const count = Math.max(1, Math.floor(quantity) || 1)
  if (count > 1) {
    if (lineTotal != null && Number.isFinite(lineTotal)) {
      return Math.round(lineTotal * 100) / 100
    }
    return Math.round(unitPrice * count * 100) / 100
  }
  return unitPrice
}
