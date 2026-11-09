/** Default until a shipper sets their own price. Whole dollars only. */
export const SHIPPER_PRICE_DEFAULT_CENTS = 10_000
export const SHIPPER_PRICE_MIN_USD = 20
export const SHIPPER_PRICE_MAX_USD = 500

export function isShipperPriceCents(cents: number): boolean {
  return (
    Number.isInteger(cents) &&
    cents >= SHIPPER_PRICE_MIN_USD * 100 &&
    cents <= SHIPPER_PRICE_MAX_USD * 100 &&
    cents % 100 === 0
  )
}

export function normalizeShipperPriceCents(value: unknown): number {
  const cents = typeof value === "number" ? value : Number(value)
  return isShipperPriceCents(cents) ? cents : SHIPPER_PRICE_DEFAULT_CENTS
}

export function shipperPriceUsd(cents: number | null | undefined): number {
  return normalizeShipperPriceCents(cents) / 100
}

/** One price, or the range buyers might pay before a shipper is matched. */
export function surfboardShippedBuyerPriceCopy(pricesUsd: readonly number[]): string {
  const prices = [...new Set(pricesUsd)].sort((a, b) => a - b)
  if (prices.length === 0) return "Buyers pay the matched shipper's price at checkout."
  if (prices.length === 1) return `Buyers pay $${prices[0]} at checkout.`
  return `Buyers pay the matched shipper's price, $${prices[0]}–$${prices[prices.length - 1]}, at checkout.`
}
