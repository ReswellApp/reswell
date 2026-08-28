import type { SupabaseClient } from "@supabase/supabase-js"
import {
  PEER_SURFBOARD_CHECKOUT_LISTING_SELECT,
  type PeerSurfboardCheckoutListingRow,
} from "@/lib/services/peerListingShippingQuote"
import { reconcileOfferFulfillmentWithListings } from "@/lib/offer-listing-shipping"
import { parseOfferLineItems, type OfferLineItem } from "@/lib/types/offer-line-item"
import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"

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

export function acceptedOfferListingIdSet(offer: AcceptedOfferCheckoutRow): Set<string> {
  const items = parseOfferLineItems(offer.line_items)
  if (items && items.length > 0) return new Set(items.map((row) => row.listing_id))
  return new Set([offer.listing_id])
}

export function acceptedOfferMatchesListingIds(
  offer: AcceptedOfferCheckoutRow,
  listingIds: string[],
): boolean {
  return listingSetsMatch(acceptedOfferListingIdSet(offer), new Set(listingIds))
}

/**
 * Unit price for a single-item ACCEPTED offer. Returns null for bundles so a
 * cart/checkout line never inherits the bundle total or a sibling line amount.
 */
export function acceptedUnitPriceForSingleItemOffer(
  offer: Pick<AcceptedOfferCheckoutRow, "listing_id" | "current_amount" | "line_items">,
  listingId: string,
): number | null {
  const items = parseOfferLineItems(offer.line_items)
  if (items && items.length > 1) return null
  if (items && items.length === 1) {
    const item = items[0]!
    if (item.listing_id !== listingId) return null
    const n = roundMoney(item.amount)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  if (offer.listing_id !== listingId) return null
  const n = roundMoney(parseFloat(String(offer.current_amount)))
  return Number.isFinite(n) && n > 0 ? n : null
}

export function offerLineItemListingIds(items: OfferLineItem[]): string[] {
  return items.map((row) => row.listing_id)
}

/** Suggested checkout delivery method from an accepted offer + current listing rows. */
export function suggestedFulfillmentFromOfferAndListings(
  offerFulfillment: string | null | undefined,
  listings: Array<{
    section?: string | null
    shipping_available?: boolean | null
    local_pickup?: boolean | null
    shipping_price?: string | number | null
    board_shipping_cost_mode?: string | null
  }>,
): "pickup" | "shipping" | null {
  if (listings.length === 0) return null
  return reconcileOfferFulfillmentWithListings(offerFulfillment, listings).fulfillment
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
    // Prefer newest if multiple ACCEPTED rows exist — `.maybeSingle()` errors on >1.
    const { data, error } = await supabase
      .from("offers")
      .select(
        "id, buyer_id, seller_id, listing_id, status, current_amount, fulfillment, shipping_amount, line_items",
      )
      .eq("listing_id", listingIdsOrdered[0]!)
      .eq("buyer_id", buyerId)
      .eq("seller_id", sellerId)
      .eq("status", "ACCEPTED")
      .order("updated_at", { ascending: false })
      .limit(1)
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
    .order("updated_at", { ascending: false })

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
      /** Delivery method after aligning the offer with current listing flags. */
      fulfillment: "pickup" | "shipping"
      fulfillmentAdjusted: boolean
      fulfillmentNote: string | null
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

  const listingIdsOrdered = lineItems.map((row) => row.listing_id)

  const { data: listingRows, error: listErr } = await supabase
    .from("listings")
    .select(
      `
      ${PEER_SURFBOARD_CHECKOUT_LISTING_SELECT},
      listing_images ( url, thumbnail_url, is_primary )
    `.trim(),
    )
    .in("id", listingIdsOrdered)
    .in("status", ["active", "pending_sale"])
    .eq("hidden_from_site", false)
    .in("section", PEER_LISTING_SECTIONS_FILTER)

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

  const listings = applyOfferLineItemsToListings(listingsOrdered, lineItems)

  const reconciled = reconcileOfferFulfillmentWithListings(offer.fulfillment, listings)

  if (!reconciled.fulfillment) {
    return {
      ok: false,
      error: reconciled.reason ?? "This offer’s delivery method is no longer available.",
    }
  }

  return {
    ok: true,
    offer,
    lineItems,
    listings,
    fulfillment: reconciled.fulfillment,
    fulfillmentAdjusted: reconciled.adjusted,
    fulfillmentNote: reconciled.reason,
  }
}

export async function validateAcceptedOfferForPaymentIntent(
  supabase: SupabaseClient,
  buyerId: string,
  offerId: string,
  listingIdsOrdered: string[],
): Promise<
  | {
      ok: true
      offer: AcceptedOfferCheckoutRow
      lineItems: OfferLineItem[]
      fulfillment: "pickup" | "shipping"
    }
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

  return {
    ok: true,
    offer,
    lineItems: loaded.lineItems,
    fulfillment: loaded.fulfillment,
  }
}
