/** Maps optional money string from the sell form to DB (null when empty/invalid). */
export function sellerPurchasePriceToDb(raw: string | undefined): number | null {
  const t = raw?.trim() ?? ""
  if (!t) return null
  const n = parseFloat(t.replace(/,/g, ""))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}
