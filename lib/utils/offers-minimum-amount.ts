import { effectiveMinimumOfferPct } from "./offers-minimum-pct.ts"

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function parsePositiveMoney(raw: unknown): number | null {
  if (raw == null || raw === "") return null
  const n =
    typeof raw === "number"
      ? raw
      : parseFloat(String(raw).trim().replace(/[$,]/g, ""))
  if (!Number.isFinite(n) || n <= 0) return null
  return roundMoney(n)
}

/** Maps optional minimum-offer money from the sell form to DB (null when empty/invalid). */
export function minimumOfferAmountToDb(raw: string | null | undefined): number | null {
  return parsePositiveMoney(raw)
}

/** Maps listing.minimum_offer_amount onto the sell form string. */
export function minimumOfferAmountFromDb(raw: unknown): string {
  const n = parsePositiveMoney(raw)
  return n == null ? "" : String(n)
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
