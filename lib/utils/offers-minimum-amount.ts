import { effectiveMinimumOfferPct } from "./offers-minimum-pct.ts"
import {
  isSurfboardListingSection,
  SURFBOARD_MIN_SALE_PRICE_USD,
} from "../listing-price-bounds.ts"

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
    section?: string | null
  },
  listPrice: number,
): number {
  const fixed = parsePositiveMoney(listing.minimum_offer_amount)
  const base =
    fixed != null
      ? fixed
      : roundMoney(listPrice * (effectiveMinimumOfferPct(listing) / 100))
  if (!isSurfboardListingSection(listing.section)) return base
  return roundMoney(Math.max(base, SURFBOARD_MIN_SALE_PRICE_USD))
}
