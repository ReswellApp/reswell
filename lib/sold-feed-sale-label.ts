/** Whether a sold tile should show how many units sold in this checkout. */
export function soldFeedShowsSaleQuantity(quantity: number): boolean {
  const count = Math.floor(quantity)
  return Number.isFinite(count) && count > 1
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
