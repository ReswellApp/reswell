/**
 * Effective minimum offer % for a listing (`listings.minimum_offer_pct`).
 * NULL / invalid uses platform default — matches legacy empty `offer_settings` behavior.
 */
export function effectiveMinimumOfferPct(listing: { minimum_offer_pct?: number | null }): number {
  const v = listing.minimum_offer_pct
  if (typeof v === "number" && Number.isFinite(v)) {
    const r = Math.round(v)
    if (r >= 50 && r <= 90) return r
  }
  return 70
}
