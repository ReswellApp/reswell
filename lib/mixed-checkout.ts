import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { isReswellShopListing } from "@/lib/reswell-shop"

export type MixedCheckoutListingRef = {
  id: string
  user_id: string
  section: string | null
}

/**
 * Validates a checkout bundle may mix peer listings from one seller with Reswell shop lines.
 * Returns the order `seller_id` (peer seller when present, else shop seller).
 */
export function resolveMixedCheckoutSellerId(
  listings: MixedCheckoutListingRef[],
): { ok: true; sellerId: string } | { ok: false; error: string } {
  if (listings.length === 0) {
    return { ok: false, error: "No listings to checkout" }
  }

  const peerSellers = new Set<string>()
  const shopSellers = new Set<string>()

  for (const l of listings) {
    if (isPeerListingSection(l.section)) {
      peerSellers.add(l.user_id)
    } else if (isReswellShopListing(l.section)) {
      shopSellers.add(l.user_id)
    } else {
      return { ok: false, error: "This listing cannot be purchased here" }
    }
  }

  if (peerSellers.size > 1) {
    return { ok: false, error: "All peer items must be from the same seller" }
  }
  if (peerSellers.size === 1) {
    return { ok: true, sellerId: [...peerSellers][0]! }
  }
  if (shopSellers.size === 0) {
    return { ok: false, error: "No listings to checkout" }
  }
  // Shop inventory is Reswell-fulfilled under the platform shop owner profile.
  // Seller id is only needed for order bookkeeping — no peer wallet credit.
  return { ok: true, sellerId: [...shopSellers][0]! }
}

/** Encode quantities for Stripe PaymentIntent metadata (listingId:qty,...). */
export function encodeListingQuantitiesMeta(qtyByListingId: Record<string, number>): string {
  return Object.entries(qtyByListingId)
    .map(([id, qty]) => `${id}:${Math.max(1, Math.floor(qty))}`)
    .join(",")
}

export function parseListingQuantitiesMeta(
  raw: string | null | undefined,
  listingIdsOrdered: string[],
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const id of listingIdsOrdered) out[id] = 1
  if (!raw?.trim()) return out
  for (const part of raw.split(",")) {
    const [idRaw, qtyRaw] = part.split(":")
    const id = idRaw?.trim() ?? ""
    const qty = Math.max(1, Math.floor(Number(qtyRaw) || 1))
    if (id && Object.prototype.hasOwnProperty.call(out, id)) {
      out[id] = qty
    }
  }
  return out
}
