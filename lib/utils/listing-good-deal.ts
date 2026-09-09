export type ListingGoodDealFields = {
  section: string
  status: string
  is_good_deal?: boolean | null
  hidden_from_site?: boolean | null
  archived_at?: string | null
}

const PURCHASABLE_LISTING_STATUSES = new Set(["active", "pending_sale"])

export function shouldShowListingGoodDeal(listing: ListingGoodDealFields): boolean {
  return (
    listing.is_good_deal === true &&
    listing.section === "surfboards" &&
    PURCHASABLE_LISTING_STATUSES.has(listing.status) &&
    listing.hidden_from_site !== true &&
    !listing.archived_at
  )
}
