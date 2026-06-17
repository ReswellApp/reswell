import type { ListingTilePriceAction } from "@/components/listing-tile"
import { isListingInStockForPurchase } from "@/lib/listing-inventory"
import { isPeerListingSection } from "@/lib/peer-listing-sections"

export type PeerListingCartFields = {
  id: string
  user_id: string
  section: string
  status: string
  local_pickup?: boolean | null
  shipping_available?: boolean | null
  hidden_from_site?: boolean | null
  archived_at?: string | null
  sync_managed?: boolean | null
  stock_quantity?: number | null
}

/** P2P listings that can use `/checkout` — same rules as checkout page (excluding self-purchase). */
export function computePeerCartPriceAction(
  viewerId: string | null,
  listing: PeerListingCartFields,
): ListingTilePriceAction | null {
  if (!isPeerListingSection(listing.section)) return null
  if (!isListingInStockForPurchase(listing)) return null
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
