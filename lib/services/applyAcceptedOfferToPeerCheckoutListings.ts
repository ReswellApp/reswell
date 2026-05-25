import type { SupabaseClient } from "@supabase/supabase-js"
import { parseOfferLineItems } from "@/lib/types/offer-line-item"
import type { PeerSurfboardCheckoutListingRow } from "@/lib/services/peerListingShippingQuote"

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

type AcceptedOfferWithBundle = {
  id: string
  current_amount: string | number
  seller_id: string
  fulfillment?: string | null
  shipping_amount?: string | number | null
  line_items?: unknown
}

async function fetchAcceptedOfferDetails(
  supabase: SupabaseClient,
  buyerId: string,
  listingId: string,
): Promise<AcceptedOfferWithBundle | null> {
  const { data, error } = await supabase
    .from("offers")
    .select("id, current_amount, seller_id, fulfillment, shipping_amount, line_items")
    .eq("listing_id", listingId)
    .eq("buyer_id", buyerId)
    .eq("status", "ACCEPTED")
    .maybeSingle()

  if (error || !data) return null
  return data as AcceptedOfferWithBundle
}

function applyLineItemPrices(
  listingsOrdered: PeerSurfboardCheckoutListingRow[],
  priceByListingId: Map<string, number>,
): PeerSurfboardCheckoutListingRow[] {
  return listingsOrdered.map((listing) => {
    const agreed = priceByListingId.get(listing.id)
    if (agreed == null) return listing
    return { ...listing, price: agreed }
  })
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

  const primaryListingId = listingsOrdered[0]!.id
  const offer = await fetchAcceptedOfferDetails(supabase, buyerId, primaryListingId)
  if (!offer || offer.seller_id !== listingsOrdered[0]!.user_id) {
    return listingsOrdered
  }

  const lineItems = parseOfferLineItems(offer.line_items)
  if (lineItems && lineItems.length > 0) {
    const checkoutIds = new Set(listingsOrdered.map((row) => row.id))
    const offerIds = new Set(lineItems.map((row) => row.listing_id))
    const idsMatch =
      checkoutIds.size === offerIds.size &&
      [...checkoutIds].every((id) => offerIds.has(id))

    if (idsMatch) {
      const priceByListingId = new Map(
        lineItems.map((row) => [row.listing_id, roundMoney(row.amount)] as const),
      )
      return applyLineItemPrices(listingsOrdered, priceByListingId)
    }

    if (listingsOrdered.length === 1) {
      const single = lineItems.find((row) => row.listing_id === primaryListingId)
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
