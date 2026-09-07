/** Fields written when a listing sells through Reswell checkout (not Mark as sold). */
export function listingSoldViaCheckoutUpdate(at = new Date().toISOString()) {
  return {
    status: "sold" as const,
    sold_off_platform: false,
    sold_off_platform_channel: null,
    sold_off_platform_detail: null,
    sold_off_platform_at: null,
    sold_reswell_helped_find_buyer: null,
    updated_at: at,
  }
}

export function listingEligibleForSellerRelist(listing: {
  status?: string | null
  sold_off_platform?: boolean | null
  archived_at?: string | null
}): boolean {
  return (
    listing.status === "sold" &&
    listing.sold_off_platform === true &&
    listing.archived_at == null
  )
}

/** Relist is only for End listing → Mark as sold. Open checkout sales stay sold. */
export function listingCanShowSellerRelist(
  listing: {
    status?: string | null
    sold_off_platform?: boolean | null
    archived_at?: string | null
  },
  soldViaOpenCheckout: boolean,
): boolean {
  return listingEligibleForSellerRelist(listing) && !soldViaOpenCheckout
}
