import { isCartEligibleSection } from "@/lib/cart-eligibility"
import {
  isListingPurchasable,
  type ListingPublicVisibilityFields,
} from "@/lib/listing-public-visibility"
import { isPeerListingSection } from "@/lib/peer-listing-sections"

export type CartPageListingGate = ListingPublicVisibilityFields & {
  section: string
}

/** Whether a saved cart row should still appear on /cart. */
export function keepCartPageListing(listing: CartPageListingGate): boolean {
  return isListingPurchasable(listing) && isCartEligibleSection(listing.section)
}

/** Peer listings whose accepted offers can replace the cart unit price. */
export function peerListingIdsForAcceptedOffers(
  listings: readonly { id: string; section: string }[],
): string[] {
  return listings
    .filter((listing) => isPeerListingSection(listing.section))
    .map((listing) => listing.id)
}
