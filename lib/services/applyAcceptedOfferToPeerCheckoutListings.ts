import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchAcceptedOfferForBuyerListing } from "@/lib/db/offers"
import type { PeerSurfboardCheckoutListingRow } from "@/lib/services/peerListingShippingQuote"

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Single-board peer checkout only: when this buyer has an ACCEPTED offer on the listing,
 * use the agreed item price for totals, fees, and payment (listing row still reflects list price in DB).
 */
export async function applyAcceptedOfferToPeerCheckoutListings(
  supabase: SupabaseClient,
  buyerId: string,
  listingsOrdered: PeerSurfboardCheckoutListingRow[],
): Promise<PeerSurfboardCheckoutListingRow[]> {
  if (listingsOrdered.length !== 1) return listingsOrdered

  const listing = listingsOrdered[0]!
  const offer = await fetchAcceptedOfferForBuyerListing(supabase, buyerId, listing.id)
  if (!offer || offer.seller_id !== listing.user_id) return listingsOrdered

  const itemPriceUsd = roundMoney(parseFloat(String(offer.current_amount)))
  if (!Number.isFinite(itemPriceUsd) || itemPriceUsd <= 0) return listingsOrdered

  return [{ ...listing, price: itemPriceUsd }]
}
