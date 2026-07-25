import type { SupabaseClient } from "@supabase/supabase-js"
import { parseOfferLineItems, type OfferLineItem } from "@/lib/types/offer-line-item"
import type { PeerSurfboardCheckoutListingRow } from "@/lib/services/peerListingShippingQuote"
import {
  applyOfferLineItemsToListings,
  findAcceptedOfferMatchingListings,
  validateAcceptedOfferForPaymentIntent,
  type AcceptedOfferCheckoutRow,
} from "@/lib/services/acceptedOfferCheckout"

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/** Apply agreed offer amounts onto checkout listing rows (line_items or current_amount). */
export function priceListingsFromAcceptedOffer(
  listingsOrdered: PeerSurfboardCheckoutListingRow[],
  offer: AcceptedOfferCheckoutRow,
  lineItems?: OfferLineItem[] | null,
): PeerSurfboardCheckoutListingRow[] {
  const items =
    lineItems && lineItems.length > 0
      ? lineItems
      : parseOfferLineItems(offer.line_items)

  if (items && items.length > 0) {
    const checkoutIds = new Set(listingsOrdered.map((row) => row.id))
    const offerIds = new Set(items.map((row) => row.listing_id))
    const idsMatch =
      checkoutIds.size === offerIds.size &&
      [...checkoutIds].every((id) => offerIds.has(id))

    if (idsMatch) {
      return applyOfferLineItemsToListings(listingsOrdered, items)
    }

    if (listingsOrdered.length === 1) {
      const single = items.find((row) => row.listing_id === listingsOrdered[0]!.id)
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

export type ApplyAcceptedOfferOptions = {
  /** When set, price from this accepted offer instead of rediscovering by listing set. */
  offerId?: string | null
}

/**
 * When a buyer has an ACCEPTED offer, use agreed item prices for checkout totals.
 * Supports single-board offers and bundled pickup offers with per-line pricing.
 *
 * Prefer `options.offerId` whenever checkout has an explicit offer (e.g. `/checkout?offer=`).
 * Rediscovery is a fallback for cart checkout without an offer id.
 */
export async function applyAcceptedOfferToPeerCheckoutListings(
  supabase: SupabaseClient,
  buyerId: string,
  listingsOrdered: PeerSurfboardCheckoutListingRow[],
  options?: ApplyAcceptedOfferOptions,
): Promise<PeerSurfboardCheckoutListingRow[]> {
  if (listingsOrdered.length === 0) return listingsOrdered

  const offerId = options?.offerId?.trim() || null
  if (offerId) {
    const check = await validateAcceptedOfferForPaymentIntent(
      supabase,
      buyerId,
      offerId,
      listingsOrdered.map((row) => row.id),
    )
    if (!check.ok) return listingsOrdered
    return priceListingsFromAcceptedOffer(listingsOrdered, check.offer, check.lineItems)
  }

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

  return priceListingsFromAcceptedOffer(listingsOrdered, offer)
}
