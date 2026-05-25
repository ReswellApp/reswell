import type { SupabaseClient } from "@supabase/supabase-js"
import { parseOfferLineItems } from "@/lib/types/offer-line-item"
import type { PeerSurfboardCheckoutListingRow } from "@/lib/services/peerListingShippingQuote"
import {
  applyOfferLineItemsToListings,
  findAcceptedOfferMatchingListings,
} from "@/lib/services/acceptedOfferCheckout"

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * When a buyer has an ACCEPTED offer, use agreed item prices for checkout totals.
 * Supports single-board offers and bundled pickup offers with per-line pricing.
 */
export async function applyAcceptedOfferToPeerCheckoutListings(
  supabase: SupabaseClient,
  buyerId: string,
  listingsOrdered: PeerSurfboardCheckoutListingRow[],
): Promise<PeerSurfboardCheckoutListingRow[]> {
  if (listingsOrdered.length === 0) return listingsOrdered

  const sellerId = listingsOrdered[0]!.user_id
  if (!listingsOrdered.every((row) => row.user_id === sellerId)) {
    return listingsOrdered
  }

  const offer = await findAcceptedOfferMatchingListings(
    supabase,
    buyerId,
    listingsOrdered.map((row) => row.id),
    sellerId,
  )

  if (!offer) return listingsOrdered

  const lineItems = parseOfferLineItems(offer.line_items)
  if (lineItems && lineItems.length > 0) {
    const checkoutIds = new Set(listingsOrdered.map((row) => row.id))
    const offerIds = new Set(lineItems.map((row) => row.listing_id))
    const idsMatch =
      checkoutIds.size === offerIds.size &&
      [...checkoutIds].every((id) => offerIds.has(id))

    if (idsMatch) {
      return applyOfferLineItemsToListings(listingsOrdered, lineItems)
    }

    if (listingsOrdered.length === 1) {
      const single = lineItems.find((row) => row.listing_id === listingsOrdered[0]!.id)
      if (single) {
        return [{ ...listingsOrdered[0]!, price: roundMoney(single.amount) }]
      }
    }

    return listingsOrdered
  }

  if (listingsOrdered.length !== 1) return listingsOrdered

  const itemPriceUsd = roundMoney(parseFloat(String(offer.current_amount)))
  if (!Number.isFinite(itemPriceUsd) || itemPriceUsd <= 0) return listingsOrdered

  return [{ ...listingsOrdered[0]!, price: itemPriceUsd }]
}
