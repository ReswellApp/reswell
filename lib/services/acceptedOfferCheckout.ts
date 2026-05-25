import type { SupabaseClient } from "@supabase/supabase-js"
import {
  PEER_SURFBOARD_CHECKOUT_LISTING_SELECT,
  type PeerSurfboardCheckoutListingRow,
} from "@/lib/services/peerListingShippingQuote"
import { parseOfferLineItems, type OfferLineItem } from "@/lib/types/offer-line-item"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export type AcceptedOfferCheckoutRow = {
  id: string
  buyer_id: string
  seller_id: string
  listing_id: string
  status: string
  current_amount: string | number
  fulfillment: string | null
  shipping_amount: string | number | null
  line_items: unknown
}

function listingSetsMatch(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((id) => b.has(id))
}

export function offerLineItemListingIds(items: OfferLineItem[]): string[] {
  return items.map((row) => row.listing_id)
}

export async function fetchAcceptedOfferById(
  supabase: SupabaseClient,
  offerId: string,
): Promise<AcceptedOfferCheckoutRow | null> {
  if (!UUID_RE.test(offerId.trim())) return null

  const { data, error } = await supabase
    .from("offers")
    .select(
      "id, buyer_id, seller_id, listing_id, status, current_amount, fulfillment, shipping_amount, line_items",
    )
    .eq("id", offerId.trim())
    .maybeSingle()

  if (error || !data) return null
  return data as AcceptedOfferCheckoutRow
}

/**
 * Finds an ACCEPTED offer whose bundled line items exactly match the checkout listing set.
 */
export async function findAcceptedOfferMatchingListings(
  supabase: SupabaseClient,
  buyerId: string,
  listingIdsOrdered: string[],
  sellerId: string,
): Promise<AcceptedOfferCheckoutRow | null> {
  if (listingIdsOrdered.length === 0) return null

  const checkoutSet = new Set(listingIdsOrdered)

  if (listingIdsOrdered.length === 1) {
    const { data, error } = await supabase
      .from("offers")
      .select(
        "id, buyer_id, seller_id, listing_id, status, current_amount, fulfillment, shipping_amount, line_items",
      )
      .eq("listing_id", listingIdsOrdered[0]!)
      .eq("buyer_id", buyerId)
      .eq("seller_id", sellerId)
      .eq("status", "ACCEPTED")
      .maybeSingle()

    if (error || !data) return null
    return data as AcceptedOfferCheckoutRow
  }

  const { data, error } = await supabase
    .from("offers")
    .select(
      "id, buyer_id, seller_id, listing_id, status, current_amount, fulfillment, shipping_amount, line_items",
    )
    .eq("buyer_id", buyerId)
    .eq("seller_id", sellerId)
    .eq("status", "ACCEPTED")

  if (error || !data?.length) return null

  for (const row of data as AcceptedOfferCheckoutRow[]) {
    const items = parseOfferLineItems(row.line_items)
    if (!items || items.length <= 1) continue
    const offerSet = new Set(items.map((item) => item.listing_id))
    if (listingSetsMatch(checkoutSet, offerSet)) {
      return row
    }
  }

  return null
}

export function applyOfferLineItemsToListings(
  listingsOrdered: PeerSurfboardCheckoutListingRow[],
  lineItems: OfferLineItem[],
): PeerSurfboardCheckoutListingRow[] {
  const priceByListingId = new Map(
    lineItems.map((row) => [row.listing_id, roundMoney(row.amount)] as const),
  )
  return listingsOrdered.map((listing) => {
    const agreed = priceByListingId.get(listing.id)
    if (agreed == null) return listing
    return { ...listing, price: agreed }
  })
}

export type LoadAcceptedOfferCheckoutResult =
  | {
      ok: true
      offer: AcceptedOfferCheckoutRow
      lineItems: OfferLineItem[]
      listings: PeerSurfboardCheckoutListingRow[]
    }
  | { ok: false; error: string }

/**
 * Loads listing rows for an ACCEPTED offer bundle (or single-item offer with line_items).
 * Caller must verify the viewer is the buyer.
 */
export async function loadAcceptedOfferCheckoutListings(
  supabase: SupabaseClient,
  offer: AcceptedOfferCheckoutRow,
): Promise<LoadAcceptedOfferCheckoutResult> {
  if (offer.status !== "ACCEPTED") {
    return { ok: false, error: "This offer is not ready for checkout." }
  }

  const parsedItems = parseOfferLineItems(offer.line_items)
  const lineItems: OfferLineItem[] =
    parsedItems && parsedItems.length > 0
      ? parsedItems
      : [
          {
            listing_id: offer.listing_id,
            amount: roundMoney(parseFloat(String(offer.current_amount))),
          },
        ]

  if (lineItems.length > 1 && offer.fulfillment !== "pickup") {
    return {
      ok: false,
      error: "Bundled offers must use local pickup. Contact the seller if you need help.",
    }
  }

  const listingIdsOrdered = lineItems.map((row) => row.listing_id)

  const { data: listingRows, error: listErr } = await supabase
    .from("listings")
    .select(PEER_SURFBOARD_CHECKOUT_LISTING_SELECT)
    .in("id", listingIdsOrdered)
    .in("status", ["active", "pending_sale"])
    .eq("hidden_from_site", false)
    .eq("section", "surfboards")

  if (listErr || !listingRows?.length) {
    return { ok: false, error: "One or more listings are no longer available." }
  }

  const byId = new Map<string, PeerSurfboardCheckoutListingRow>(
    (listingRows as unknown as PeerSurfboardCheckoutListingRow[]).map((row) => [row.id, row]),
  )

  const listingsOrdered = listingIdsOrdered
    .map((id) => byId.get(id))
    .filter((row): row is PeerSurfboardCheckoutListingRow => row != null)

  if (listingsOrdered.length !== listingIdsOrdered.length) {
    return { ok: false, error: "One or more listings are no longer available." }
  }

  if (!listingsOrdered.every((row) => row.user_id === offer.seller_id)) {
    return { ok: false, error: "Invalid offer listings." }
  }

  if (lineItems.length > 1) {
    if (!listingsOrdered.every((row) => row.local_pickup !== false)) {
      return {
        ok: false,
        error: "Every board in this bundle must offer local pickup.",
      }
    }
  }

  const listings = applyOfferLineItemsToListings(listingsOrdered, lineItems)

  return { ok: true, offer, lineItems, listings }
}

export async function validateAcceptedOfferForPaymentIntent(
  supabase: SupabaseClient,
  buyerId: string,
  offerId: string,
  listingIdsOrdered: string[],
): Promise<
  | { ok: true; offer: AcceptedOfferCheckoutRow; lineItems: OfferLineItem[] }
  | { ok: false; error: string }
> {
  const offer = await fetchAcceptedOfferById(supabase, offerId)
  if (!offer) {
    return { ok: false, error: "Offer not found." }
  }
  if (offer.buyer_id !== buyerId) {
    return { ok: false, error: "This offer is not yours." }
  }
  if (offer.status !== "ACCEPTED") {
    return { ok: false, error: "This offer is not accepted." }
  }

  const loaded = await loadAcceptedOfferCheckoutListings(supabase, offer)
  if (!loaded.ok) {
    return { ok: false, error: loaded.error }
  }

  const checkoutSet = new Set(listingIdsOrdered)
  const offerSet = new Set(loaded.lineItems.map((row) => row.listing_id))
  if (!listingSetsMatch(checkoutSet, offerSet)) {
    return { ok: false, error: "Checkout listings do not match this offer." }
  }

  return { ok: true, offer, lineItems: loaded.lineItems }
}
