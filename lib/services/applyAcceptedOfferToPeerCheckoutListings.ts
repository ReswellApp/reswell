import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchAcceptedOffersForBuyerListings } from "@/lib/db/offers"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { parseOfferLineItems, type OfferLineItem } from "@/lib/types/offer-line-item"
import type { PeerSurfboardCheckoutListingRow } from "@/lib/services/peerListingShippingQuote"
import {
  acceptedUnitPriceForSingleItemOffer,
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
 * Supports single-item offers and bundled offers with per-line pricing.
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

  const pricedById = new Map<string, number>()
  const peerBySeller = new Map<string, PeerSurfboardCheckoutListingRow[]>()

  for (const row of listingsOrdered) {
    if (!isPeerListingSection(row.section)) continue
    const group = peerBySeller.get(row.user_id) ?? []
    group.push(row)
    peerBySeller.set(row.user_id, group)
  }

  for (const [sellerId, rows] of peerBySeller) {
    const offer = await findAcceptedOfferMatchingListings(
      supabase,
      buyerId,
      rows.map((row) => row.id),
      sellerId,
    )
    if (offer) {
      for (const priced of priceListingsFromAcceptedOffer(rows, offer)) {
        const amount = roundMoney(parseFloat(String(priced.price)))
        if (Number.isFinite(amount) && amount > 0) pricedById.set(priced.id, amount)
      }
      continue
    }

    if (rows.length <= 1) continue

    const singles = await fetchAcceptedOffersForBuyerListings(
      supabase,
      buyerId,
      rows.map((row) => row.id),
    )
    for (const row of rows) {
      if (pricedById.has(row.id)) continue
      const single = singles.find((o) => o.listing_id === row.id && o.seller_id === sellerId)
      if (!single) continue
      const unit = acceptedUnitPriceForSingleItemOffer(single, row.id)
      if (unit != null) pricedById.set(row.id, unit)
    }
  }

  if (pricedById.size === 0) return listingsOrdered

  return listingsOrdered.map((row) => {
    const agreed = pricedById.get(row.id)
    if (agreed == null) return row
    return { ...row, price: agreed }
  })
}
