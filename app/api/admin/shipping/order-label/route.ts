import { createServiceRoleClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { fetchSellerShipFromLabelName } from "@/lib/db/sellerShipFromLabel"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { markOrderShippedWithTrackingAsAdmin } from "@/lib/services/markOrderShipped"
import { attachAdminShippingLabelToOrder } from "@/lib/services/adminOrderShippingLabelNotify"
import {
  effectiveBoardShippingMode,
  PEER_SURFBOARD_CHECKOUT_LISTING_SELECT,
  type PeerListingForShippingQuote,
} from "@/lib/services/peerListingShippingQuote"
import {
  fetchRatesForSurfboardOrder,
  purchaseLabelWithRateId,
  resolveAddressesForLabel,
  resolveOrderLabelParcelFromListing,
} from "@/lib/services/orderShippingLabel"
import { getCheapestReswellRateForListing } from "@/lib/services/reswellListingShippingRate"
import { isShipEngineConfigured } from "@/lib/shipengine/config"
import {
  orderShippingJsonToRateQuoteAddress,
  rateQuoteFieldsToShippingInput,
} from "@/lib/shipping/rate-address"
import { adminOrderShippingLabelPostBodySchema } from "@/lib/validations/order-shipping-label"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import type { ProfileAddressRow } from "@/lib/profile-address"
import type { ListingPackedParcelSource } from "@/lib/reswell-packed-parcel-from-listing"

export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function num(v: string | number | null | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * GET /api/admin/shipping/order-label?order_id=
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  const orderId = request.nextUrl.searchParams.get("order_id")?.trim() ?? ""
  if (!orderId || !UUID_RE.test(orderId)) {
    return NextResponse.json({ error: "Invalid order" }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      seller_id,
      fulfillment_method,
      delivery_status,
      shipping_address,
      shipping_amount,
      listings (
        ${PEER_SURFBOARD_CHECKOUT_LISTING_SELECT}
      )
    `,
    )
    .eq("id", orderId)
    .maybeSingle()

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const row = order as unknown as {
    id: string
    order_num: string | null
    seller_id: string
    fulfillment_method: string | null
    delivery_status: string
    shipping_address: unknown
    shipping_amount?: string | number | null
    listings: Record<string, unknown> | Record<string, unknown>[] | null
  }

  const listing = Array.isArray(row.listings) ? row.listings[0] : row.listings
  const section = typeof listing?.section === "string" ? listing.section : ""
  const listingTitle =
    typeof listing?.title === "string" ? listing.title.trim() : listing?.title != null ? String(listing.title) : "Item"

  const autoLabelParcel = listing
    ? resolveOrderLabelParcelFromListing(listing as unknown as ListingPackedParcelSource)
    : { ok: false as const, error: "Listing not loaded." }

  const reasons: string[] = []
  if (!isPeerListingSection(section)) {
    reasons.push("Labels are available for marketplace peer listings only.")
  }
  if (row.fulfillment_method !== "shipping") reasons.push("This order is not shipping fulfillment.")
  if (row.delivery_status !== "pending") reasons.push("Tracking is already set for this order.")
  const eligible = reasons.length === 0

  const displayOrderNum = formatOrderNumForCustomer(row.order_num, row.id)
  const buyerPaidShippingUsd = num(row.shipping_amount)
  const boardMode =
    listing && typeof listing === "object"
      ? effectiveBoardShippingMode(listing as unknown as PeerListingForShippingQuote)
      : "reswell"

  return NextResponse.json({
    data: {
      eligible,
      ineligibleReasons: reasons,
      shipEngineConfigured: isShipEngineConfigured(),
      order: {
        id: row.id,
        orderNum: row.order_num,
        displayOrderNum,
        listingTitle,
        section,
        fulfillmentMethod: row.fulfillment_method,
        deliveryStatus: row.delivery_status,
        sellerId: row.seller_id,
      },
      checkoutLane: {
        buyerPaidShippingUsd,
        boardShippingMode: boardMode,
        /** Same parcel + listing ship-from geocode + buyer address as surfboard checkout quotes (cheapest carrier). */
        quoteMethod:
          "Uses the listing’s packed dimensions and seller locality (checkout lane), the buyer’s order address, and the cheapest ShipEngine rate — matching peer checkout when the listing uses Reswell-calculated shipping.",
      },
      autoLabelParcel:
        autoLabelParcel.ok === true
          ? {
              ok: true as const,
              lengthIn: autoLabelParcel.parcel.lengthIn,
              widthIn: autoLabelParcel.parcel.widthIn,
              heightIn: autoLabelParcel.parcel.heightIn,
              weightLb: autoLabelParcel.parcel.weightLb,
              source: autoLabelParcel.parcel.source,
            }
          : { ok: false as const, error: autoLabelParcel.error },
    },
  })
}

/**
 * POST /api/admin/shipping/order-label
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = adminOrderShippingLabelPostBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 })
  }

  const orderId = parsed.data.order_id
  const supabase = createServiceRoleClient()

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      buyer_id,
      seller_id,
      listing_id,
      fulfillment_method,
      delivery_status,
      shipping_address,
      shipping_amount,
      listings (
        ${PEER_SURFBOARD_CHECKOUT_LISTING_SELECT}
      )
    `,
    )
    .eq("id", orderId)
    .maybeSingle()

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const o = order as unknown as {
    id: string
    order_num: string | null
    buyer_id: string
    seller_id: string
    listing_id: string
    fulfillment_method: string | null
    delivery_status: string
    shipping_address: unknown
    shipping_amount?: string | number | null
    listings: Record<string, unknown> | Record<string, unknown>[] | null
  }

  const listing = Array.isArray(o.listings) ? o.listings[0] : o.listings
  if (!listing || !isPeerListingSection((listing as { section?: string }).section)) {
    return NextResponse.json(
      { error: "Shipping labels are only for marketplace peer listings." },
      { status: 400 },
    )
  }
  if (o.fulfillment_method !== "shipping") {
    return NextResponse.json({ error: "This order is not a shipping order." }, { status: 400 })
  }
  if (o.delivery_status !== "pending") {
    return NextResponse.json({ error: "This order already has tracking." }, { status: 409 })
  }

  const listingForQuote = listing as unknown as PeerListingForShippingQuote
  const body = parsed.data

  if (body.action === "purchase_checkout_lane") {
    const shipToFields = orderShippingJsonToRateQuoteAddress(o.shipping_address)
    if (!shipToFields) {
      return NextResponse.json(
        { error: "This order does not have a complete buyer shipping address." },
        { status: 400 },
      )
    }
    const shipTo = rateQuoteFieldsToShippingInput(shipToFields)

    const sellerShipFromName = await fetchSellerShipFromLabelName(supabase, o.seller_id)
    const quoted = await getCheapestReswellRateForListing({
      listing: listingForQuote,
      shipTo,
      diagnosticTag: `admin-checkout-lane:${o.id}`,
      sellerShipFromName,
    })
    if (!quoted.ok) {
      return NextResponse.json({ error: quoted.error }, { status: 422 })
    }

    const rateId = quoted.cheapest.rate_id
    if (!rateId) {
      return NextResponse.json({ error: "No purchasable rate id from ShipEngine." }, { status: 422 })
    }

    const purchased = await purchaseLabelWithRateId(rateId)
    if (!purchased.ok) {
      return NextResponse.json({ error: purchased.error }, { status: purchased.status })
    }

    const listingTitle =
      typeof (listing as { title?: string }).title === "string"
        ? (listing as { title: string }).title.trim() || "Item"
        : "Item"

    const attached = await attachAdminShippingLabelToOrder({
      supabase,
      adminUserId: gate.ctx.user.id,
      order: { id: o.id, buyer_id: o.buyer_id, seller_id: o.seller_id, listing_id: o.listing_id },
      listingTitle,
      displayOrderNum: formatOrderNumForCustomer(o.order_num, o.id),
      source: "shipengine_checkout_lane",
      labelPdfUrl: purchased.result.labelUrl,
      labelStoragePath: null,
      trackingNumber: purchased.result.trackingNumber,
      trackingCarrier: purchased.result.trackingCarrier,
      shipengineRateId: rateId,
      labelCostUsd: purchased.result.costAmount,
      labelCostCurrency: purchased.result.costCurrency,
    })

    if (!attached.ok) {
      return NextResponse.json({ error: attached.error }, { status: attached.status })
    }

    const shippingPaid = num(o.shipping_amount)
    const mode = effectiveBoardShippingMode(listingForQuote)
    let quoteVsPaidNote: string | undefined
    if (mode === "reswell" && shippingPaid > 0) {
      const delta = Math.abs(quoted.cheapest.totalAmount - shippingPaid)
      if (delta > 0.08) {
        quoteVsPaidNote = `Buyer paid $${shippingPaid.toFixed(2)} at checkout; today’s cheapest rate is $${quoted.cheapest.totalAmount.toFixed(2)}.`
      }
    }

    return NextResponse.json({
      data: {
        labelUrl: purchased.result.labelUrl,
        trackingNumber: purchased.result.trackingNumber,
        trackingCarrier: purchased.result.trackingCarrier,
        orderDisplayNum: formatOrderNumForCustomer(o.order_num, o.id),
        liveQuoteUsd: quoted.cheapest.totalAmount,
        carrierLabel: quoted.cheapest.carrierName,
        serviceName: quoted.cheapest.serviceName,
        quoteVsPaidNote,
      },
    })
  }

  if (body.action === "rates") {
    let sellerAddressId = body.seller_address_id?.trim() || null
    if (!sellerAddressId) {
      const { data: addrRows } = await supabase
        .from("addresses")
        .select("*")
        .eq("profile_id", o.seller_id)
        .order("is_default", { ascending: false })
      const rows = (addrRows ?? []) as ProfileAddressRow[]
      const preferred = rows.find((r) => r.is_default) ?? rows[0]
      if (!preferred) {
        return NextResponse.json(
          { error: "Seller has no ship-from address on file. Add one on the seller’s profile first." },
          { status: 400 },
        )
      }
      sellerAddressId = preferred.id
    }

    const { data: addr, error: addrErr } = await supabase
      .from("addresses")
      .select("*")
      .eq("id", sellerAddressId)
      .eq("profile_id", o.seller_id)
      .maybeSingle()

    if (addrErr || !addr) {
      return NextResponse.json({ error: "Seller address not found" }, { status: 400 })
    }

    const resolved = resolveAddressesForLabel({
      sellerAddress: addr as ProfileAddressRow,
      orderShippingJson: o.shipping_address,
    })
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 })
    }

    let parcel: { lengthIn: number; widthIn: number; heightIn: number; weightLb: number }
    if (body.parcel) {
      parcel = {
        lengthIn: body.parcel.length_in,
        widthIn: body.parcel.width_in,
        heightIn: body.parcel.height_in,
        weightLb: body.parcel.weight_lb,
      }
    } else {
      const fromListing = resolveOrderLabelParcelFromListing(listing as unknown as ListingPackedParcelSource)
      if (!fromListing.ok) {
        return NextResponse.json({ error: fromListing.error }, { status: 400 })
      }
      parcel = {
        lengthIn: fromListing.parcel.lengthIn,
        widthIn: fromListing.parcel.widthIn,
        heightIn: fromListing.parcel.heightIn,
        weightLb: fromListing.parcel.weightLb,
      }
    }

    const ratesResult = await fetchRatesForSurfboardOrder({
      shipFrom: resolved.from,
      shipTo: resolved.to,
      parcel,
    })

    if (!ratesResult.ok) {
      return NextResponse.json({ error: ratesResult.error }, { status: ratesResult.status })
    }

    return NextResponse.json({
      data: {
        rates: ratesResult.rates,
        orderDisplayNum: formatOrderNumForCustomer(o.order_num, o.id),
      },
    })
  }

  const purchased = await purchaseLabelWithRateId(body.rate_id)
  if (!purchased.ok) {
    return NextResponse.json({ error: purchased.error }, { status: purchased.status })
  }

  const marked = await markOrderShippedWithTrackingAsAdmin(
    supabase,
    { id: o.id, buyer_id: o.buyer_id, listing_id: o.listing_id },
    o.seller_id,
    purchased.result.trackingNumber,
    purchased.result.trackingCarrier,
  )

  if (!marked.ok) {
    return NextResponse.json({ error: marked.error }, { status: marked.status })
  }

  return NextResponse.json({
    data: {
      labelUrl: purchased.result.labelUrl,
      trackingNumber: purchased.result.trackingNumber,
      trackingCarrier: purchased.result.trackingCarrier,
      orderDisplayNum: formatOrderNumForCustomer(o.order_num, o.id),
    },
  })
}
