import type { ListingTilePriceAction } from "@/components/listing-tile"

export type PeerListingCartFields = {
  id: string
  user_id: string
  section: string
  status: string
  local_pickup?: boolean | null
  shipping_available?: boolean | null
}

/** P2P listings that can use `/checkout` — same rules as checkout page (excluding self-purchase). */
export function computePeerCartPriceAction(
  viewerId: string | null,
  listing: PeerListingCartFields,
): ListingTilePriceAction | null {
  if (listing.section !== "used" && listing.section !== "surfboards") return null
  if (listing.status !== "active" && listing.status !== "pending_sale") return null
  const lp = listing.local_pickup !== false
  const sa = !!listing.shipping_available
  if (!lp && !sa) return null
  if (viewerId && listing.user_id === viewerId) return null
  return {
    type: "addToCartServer",
    listingId: listing.id,
    isLoggedIn: !!viewerId,
  }
}
