import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { isReswellShopListing } from "@/lib/reswell-shop"

/** Peer marketplace or Reswell shop inventory — both may use the DB cart. */
export function isCartEligibleSection(section: string | null | undefined): boolean {
  return isPeerListingSection(section) || isReswellShopListing(section)
}
