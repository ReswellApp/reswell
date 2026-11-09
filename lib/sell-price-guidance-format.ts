/** Whole-dollar string for the sell listing-price input. */
export function sellPriceGuidanceToInputValue(usd: number): string {
  return String(Math.max(1, Math.round(usd)))
}
