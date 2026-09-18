/**
 * Saved seller ship-from is the source of truth for rates and labels.
 * Listing / dropoff city-state is only used when the seller has no address.
 */
export function coalesceReswellRateShipFrom<T>(input: {
  sellerShipFromAddress: T | null
  listingShipFrom: { ok: true; address: T } | { ok: false; error: string } | null
}): { ok: true; address: T } | { ok: false; error: string } {
  if (input.sellerShipFromAddress) {
    return { ok: true, address: input.sellerShipFromAddress }
  }
  if (input.listingShipFrom?.ok) {
    return input.listingShipFrom
  }
  return (
    input.listingShipFrom ?? {
      ok: false,
      error: "Seller location is missing — shipping cannot be calculated.",
    }
  )
}
