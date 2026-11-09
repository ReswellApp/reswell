/** Stable effect/idempotency key for checkout unit maps. Ignores object identity. */
export function listingQuantitiesKey(
  quantities?: Record<string, number> | null,
): string {
  if (!quantities) return ""
  return Object.entries(quantities)
    .map(([id, raw]) => {
      const listingId = id.trim()
      const qty = Math.max(1, Math.floor(Number(raw) || 0))
      return listingId && Number.isFinite(qty) ? ([listingId, qty] as const) : null
    })
    .filter((entry): entry is readonly [string, number] => entry != null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, qty]) => `${id}:${qty}`)
    .join(",")
}
