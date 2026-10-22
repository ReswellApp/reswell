import type { SupabaseClient } from "@supabase/supabase-js"
import { findOpenBuyerOfferOnListing } from "@/lib/db/offers"
import { dashboardOffersPath } from "@/lib/utils/offers-dashboard-display"

/** Offers-page URL for the viewer’s open offer on this listing, if they have one. */
export async function resolveListingBuyerOpenOfferHref(
  supabase: SupabaseClient,
  listingId: string,
  buyerId: string,
): Promise<string | null> {
  const offer = await findOpenBuyerOfferOnListing(supabase, listingId, buyerId)
  if (!offer) return null
  return dashboardOffersPath({ role: "buyer", offerId: offer.id })
}
