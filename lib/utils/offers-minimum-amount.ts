import { effectiveMinimumOfferPct } from "./offers-minimum-pct"

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Effective minimum offer amount for a listing.
 * If `minimum_offer_amount` is set, use that (takes precedence).
 * Otherwise, calculate from `minimum_offer_pct` as a percentage of list price.
 */
export function effectiveMinimumOfferAmount(
  listing: {
    minimum_offer_amount?: string | number | null
    minimum_offer_pct?: number | null
  },
  listPrice: number,
): number {
  const fixedAmount = listing.minimum_offer_amount
  if (fixedAmount != null) {
    const parsed = typeof fixedAmount === "string" ? parseFloat(fixedAmount) : fixedAmount
    if (Number.isFinite(parsed) && parsed > 0) {
      return roundMoney(parsed)
    }
  }

  const minPct = effectiveMinimumOfferPct(listing)
  return roundMoney(listPrice * (minPct / 100))
}
