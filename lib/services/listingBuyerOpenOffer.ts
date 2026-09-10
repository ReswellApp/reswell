import type { SupabaseClient } from "@supabase/supabase-js"
import { findOpenBuyerOfferOnListing } from "@/lib/db/offers"
import { getConversationForBuyerSellerListing } from "@/lib/db/conversations"
import { offerMessagesHref } from "@/lib/utils/offer-messages-href"

/** Listing-scoped messages URL for the viewer’s open offer, if they have one. */
export async function resolveListingBuyerOpenOfferHref(
  supabase: SupabaseClient,
  listingId: string,
  buyerId: string,
): Promise<string | null> {
  const offer = await findOpenBuyerOfferOnListing(supabase, listingId, buyerId)
  if (!offer) return null

  const conversation = await getConversationForBuyerSellerListing(
    supabase,
    offer.buyer_id,
    offer.seller_id,
    offer.listing_id,
  )

  return offerMessagesHref(offer, "buyer", conversation?.id ?? null)
}
