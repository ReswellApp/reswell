/**
 * Human-readable ship-from line from surfboard listing locality (`/sell` → `listings.city` / `listings.state`).
 * Carrier rating uses the same fields first in `resolveListingShipFromForRating`.
 */
export function listingShipFromDisplayLine(city?: string | null, state?: string | null): string | null {
  const c = typeof city === "string" ? city.trim() : ""
  const s = typeof state === "string" ? state.trim() : ""
  if (c && s) return `${c}, ${s}`
  if (c) return c
  if (s) return s
  return null
}
