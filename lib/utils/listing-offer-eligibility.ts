/** Listing statuses that can receive or send marketplace offers. */
export const OFFERABLE_LISTING_STATUSES = ["active", "pending_sale"] as const

export type OfferableListingStatus = (typeof OFFERABLE_LISTING_STATUSES)[number]

const OFFERABLE_STATUS_SET = new Set<string>(OFFERABLE_LISTING_STATUSES)

/**
 * Whether a listing status still accepts offers (buyer- or seller-initiated).
 * Unknown / missing status is treated as not offerable so UI never assumes
 * sold or ended listings are still live.
 */
export function listingStatusAcceptsOffers(
  status: string | null | undefined,
): boolean {
  return typeof status === "string" && OFFERABLE_STATUS_SET.has(status)
}
