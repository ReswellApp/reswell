/**
 * Public listing location only — city and state from `listings.city` / `listings.state`.
 * Never pass street, ZIP, or a saved `addresses` row here. The seller street
 * address is the rate/label origin (`resolveSellerShipFromAddress`).
 */
export function listingShipFromDisplayLine(city?: string | null, state?: string | null): string | null {
  const c = typeof city === "string" ? city.trim() : ""
  const s = typeof state === "string" ? state.trim() : ""
  if (c && s) return `${c}, ${s}`
  if (c) return c
  if (s) return s
  return null
}
