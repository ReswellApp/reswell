import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchSellerShipFromLabelName } from "@/lib/db/sellerShipFromLabel"
import { isReswellShopListing } from "@/lib/reswell-shop"
import { attachOrderShippingLabel } from "@/lib/services/attachOrderShippingLabel"
import { markOrderShippedWithTrackingAsAdmin } from "@/lib/services/markOrderShipped"
import {
  PEER_SURFBOARD_CHECKOUT_LISTING_SELECT,
  type PeerListingForShippingQuote,
} from "@/lib/services/peerListingShippingQuote"
import { purchaseShipEngineLabelForOrderOnce } from "@/lib/services/purchaseShipEngineLabelForOrderOnce"
import { getCheapestReswellRateForListings } from "@/lib/services/reswellListingShippingRate"
import { getStripe } from "@/lib/stripe-server"
import { isShipEngineConfigured } from "@/lib/shipengine/config"
import {
  orderShippingJsonToRateQuoteAddress,
  rateQuoteFieldsToShippingInput,
} from "@/lib/shipping/rate-address"

export type FulfillReswellShopOrderResult =
  | {
      ok: true
      trackingNumber: string
      trackingCarrier: string | null
      labelUrl: string | null
      alreadyPurchased: boolean
    }
  | { ok: false; error: string; status: number }

/**
 * Admin fulfills a Reswell shop order: buy the cheapest ShipEngine label from the
 * product's packed package dims, attach tracking, mark shipped, and notify the buyer
 * (thread + Klaviyo **Order Shipped**).
 */
export async function fulfillReswellShopOrder(
  supabase: SupabaseClient,
  params: { orderId: string },
): Promise<FulfillReswellShopOrderResult> {
  if (!isShipEngineConfigured()) {
    return {
      ok: false,
      error: "ShipEngine is not configured (missing SHIPENGINE_API_KEY).",
      status: 503,
    }
  }

  const { data: order, error: ordErr } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      buyer_id,
      seller_id,
      listing_id,
      status,
      fulfillment_method,
      delivery_status,
      shipping_address,
      stripe_checkout_session_id,
      tracking_number,
      tracking_carrier,
      listings (
        ${PEER_SURFBOARD_CHECKOUT_LISTING_SELECT}
      )
    `,
    )
    .eq("id", params.orderId)
    .maybeSingle()

  if (ordErr || !order) {
    return { ok: false, error: "Order not found", status: 404 }
  }

  const o = order as unknown as {
    id: string
    order_num: string | null
    buyer_id: string | null
    seller_id: string
    listing_id: string
    status: string
    fulfillment_method: string | null
    delivery_status: string
    shipping_address: unknown
    stripe_checkout_session_id: string | null
    tracking_number: string | null
    tracking_carrier: string | null
    listings: Record<string, unknown> | Record<string, unknown>[] | null
  }

  const listingRaw = o.listings
  const listing = (Array.isArray(listingRaw) ? listingRaw[0] : listingRaw) as
    | PeerListingForShippingQuote
    | null

  if (!listing || !isReswellShopListing(listing.section)) {
    return {
      ok: false,
      error: "This order is not a Reswell shop order.",
      status: 400,
    }
  }

  if (o.status !== "confirmed") {
    return {
      ok: false,
      error: "Only confirmed orders can be fulfilled.",
      status: 409,
    }
  }

  if (o.fulfillment_method !== "shipping") {
    return {
      ok: false,
      error: "Only shipping orders can be fulfilled with a label.",
      status: 400,
    }
  }

  if (o.delivery_status !== "pending") {
    return {
      ok: false,
      error: "This order is already shipped or delivered.",
      status: 409,
    }
  }

  const buyerId = o.buyer_id
  if (!buyerId) {
    return {
      ok: false,
      error: "Order has no buyer account — cannot send shipment notifications.",
      status: 400,
    }
  }

  /** Multi-item shop carts ship as one box — combine packed parcels when present. */
  let listingsForQuote: PeerListingForShippingQuote[] = [listing]
  const { data: itemRows } = await supabase
    .from("order_items")
    .select(`sort_order, listings ( ${PEER_SURFBOARD_CHECKOUT_LISTING_SELECT} )`)
    .eq("order_id", o.id)
    .order("sort_order", { ascending: true })

  if (itemRows && itemRows.length > 1) {
    const lineListings = itemRows
      .map((r) => {
        const l = (r as { listings?: unknown }).listings
        return (Array.isArray(l) ? l[0] : l) as PeerListingForShippingQuote | null | undefined
      })
      .filter((l): l is PeerListingForShippingQuote => l != null && isReswellShopListing(l.section))
    if (lineListings.length === itemRows.length) {
      listingsForQuote = lineListings
    }
  }

  const shipToFields = orderShippingJsonToRateQuoteAddress(o.shipping_address)
  if (!shipToFields) {
    return {
      ok: false,
      error: "This order does not have a complete buyer shipping address.",
      status: 400,
    }
  }
  const shipTo = rateQuoteFieldsToShippingInput(shipToFields)
  const sellerShipFromName = await fetchSellerShipFromLabelName(supabase, o.seller_id)

  let rateId: string | null = null
  const paymentIntentId = o.stripe_checkout_session_id?.trim()
  if (paymentIntentId) {
    try {
      const stripe = getStripe()
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
      rateId = pi.metadata.shipengine_rate_id?.trim() || null
    } catch (e) {
      console.warn("[fulfillReswellShopOrder] could not read PI rate id:", e)
    }
  }

  if (!rateId) {
    const quoted = await getCheapestReswellRateForListings({
      listings: listingsForQuote,
      shipTo,
      diagnosticTag: `admin-shop-fulfill:${o.id}`,
      sellerShipFromName,
      section: listing.section ?? "new",
    })
    if (!quoted.ok) {
      return { ok: false, error: quoted.error, status: 422 }
    }
    rateId = quoted.cheapest.rate_id
  }

  if (!rateId) {
    return {
      ok: false,
      error: "ShipEngine returned no purchasable rate for this package.",
      status: 422,
    }
  }

  const purchased = await purchaseShipEngineLabelForOrderOnce({
    supabase,
    orderId: o.id,
    ownerKey: `admin_shop_fulfill:${o.id}`,
    rateId,
  })

  if (!purchased.ok) {
    return { ok: false, error: purchased.error, status: purchased.status }
  }

  const trackingNumber = purchased.result.trackingNumber?.trim() || ""
  const trackingCarrier = purchased.result.trackingCarrier?.trim() || null

  if (!trackingNumber) {
    return {
      ok: false,
      error: "ShipEngine purchased a label but returned no tracking number.",
      status: 502,
    }
  }

  if (!purchased.alreadyPurchased) {
    const attached = await attachOrderShippingLabel({
      supabase,
      orderId: o.id,
      origin: "auto_reswell_checkout",
      labelPdfUrl: purchased.result.labelUrl,
      labelStoragePath: null,
      trackingNumber,
      trackingCarrier,
      shipengineRateId: rateId,
    })
    if (!attached.ok) {
      return { ok: false, error: attached.error, status: 500 }
    }
  } else if (!o.tracking_number?.trim()) {
    const { error: trackErr } = await supabase
      .from("orders")
      .update({
        tracking_number: trackingNumber,
        tracking_carrier: trackingCarrier,
        updated_at: new Date().toISOString(),
      })
      .eq("id", o.id)
      .eq("delivery_status", "pending")
    if (trackErr) {
      console.error("[fulfillReswellShopOrder] tracking patch:", trackErr)
      return { ok: false, error: "Could not save tracking on the order.", status: 500 }
    }
  }

  const marked = await markOrderShippedWithTrackingAsAdmin(
    supabase,
    {
      id: o.id,
      buyer_id: buyerId,
      listing_id: o.listing_id,
    },
    o.seller_id,
    trackingNumber,
    trackingCarrier,
  )

  if (!marked.ok) {
    return { ok: false, error: marked.error, status: marked.status }
  }

  return {
    ok: true,
    trackingNumber,
    trackingCarrier,
    labelUrl: purchased.result.labelUrl,
    alreadyPurchased: purchased.alreadyPurchased,
  }
}
