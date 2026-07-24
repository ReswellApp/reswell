import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { isReswellShopListing } from "@/lib/reswell-shop"

/** Peer marketplace or Reswell shop inventory — both may use the DB cart. */
export function isCartEligibleSection(section: string | null | undefined): boolean {
  return isPeerListingSection(section) || isReswellShopListing(section)
}

/**
 * Peer sellers cannot buy their own listings.
 * Reswell shop rows may use an admin `user_id` for bookkeeping only — never block purchase.
 */
export function isBlockedOwnListingPurchase(
  listing: { user_id: string; section?: string | null },
  buyerId: string,
): boolean {
  if (!buyerId || listing.user_id !== buyerId) return false
  return !isReswellShopListing(listing.section)
}
