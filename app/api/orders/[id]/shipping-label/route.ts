import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { PEER_SURFBOARD_CHECKOUT_LISTING_SELECT } from "@/lib/services/peerListingShippingQuote"
import {
  fetchRatesForSurfboardOrder,
  resolveAddressesForLabel,
  resolveOrderLabelParcelFromListing,
} from "@/lib/services/orderShippingLabel"
import { loadSellerShippingLabelOrderContext } from "@/lib/services/sellerShippingLabelCheckout"
import { isShipEngineConfigured } from "@/lib/shipengine/config"
import { shippingLabelPostBodySchema } from "@/lib/validations/order-shipping-label"
import type { ListingPackedParcelSource } from "@/lib/reswell-packed-parcel-from-listing"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { isSurfboardLabelParcelLimitError } from "@/lib/shipping/surfboard-label-limits"

export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const raw = (await params).id
  const orderId = decodeURIComponent(typeof raw === "string" ? raw.trim() : "").trim()
  if (!orderId || !UUID_RE.test(orderId)) {
    return NextResponse.json({ error: "Invalid order" }, { status: 400 })
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      listing_id,
      fulfillment_method,
      delivery_status,
      shipping_address,
      listings ( section, title )
    `,
    )
    .eq("id", orderId)
    .eq("seller_id", user.id)
    .maybeSingle()

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const row = order as {
    id: string
    order_num: string | null
    listing_id: string
    fulfillment_method: string | null
    delivery_status: string
    shipping_address: unknown
    listings:
      | { section: string; title: string | null }
      | { section: string; title: string | null }[]
      | null
  }

  const listing = Array.isArray(row.listings) ? row.listings[0] : row.listings
  const section = listing?.section ?? ""
  const listingTitle = listing?.title?.trim() ?? "Item"

  const { data: listingForParcel } = await supabase
    .from("listings")
    .select(PEER_SURFBOARD_CHECKOUT_LISTING_SELECT)
    .eq("id", row.listing_id)
    .maybeSingle()

  const autoLabelParcel = listingForParcel
    ? resolveOrderLabelParcelFromListing(listingForParcel as ListingPackedParcelSource)
    : { ok: false as const, error: "Could not load listing for this order." }

  const reasons: string[] = []
  if (!isPeerListingSection(section)) {
    reasons.push("Labels are available for marketplace peer listings only.")
  }
  if (row.fulfillment_method !== "shipping") reasons.push("This order is not shipping fulfillment.")
  if (row.delivery_status !== "pending") reasons.push("Tracking is already set for this order.")

  if (!autoLabelParcel.ok && isSurfboardLabelParcelLimitError(autoLabelParcel.error)) {
    reasons.push(autoLabelParcel.error)
  }

  if (user) {
    const sellerCtx = await loadSellerShippingLabelOrderContext(supabase, orderId, user.id)
    if (!sellerCtx.ok && sellerCtx.status !== 404) {
      reasons.push(sellerCtx.error)
    }
  }

  const eligible = reasons.length === 0

  const { data: addrRows } = await supabase
    .from("addresses")
    .select("*")
    .eq("profile_id", user.id)
    .order("is_default", { ascending: false })

  const sellerAddresses = (addrRows ?? []).map((a) => {
    const ar = a as ProfileAddressRow
    const one = [ar.line1, [ar.city, ar.state, ar.postal_code].filter(Boolean).join(", ")]
      .filter(Boolean)
      .join(" · ")
    return {
      id: ar.id,
      label: ar.label?.trim() || "Address",
      oneLine: one,
      isDefault: ar.is_default,
    }
  })

  const displayOrderNum = formatOrderNumForCustomer(row.order_num, row.id)

  return NextResponse.json({
    data: {
      eligible,
      ineligibleReasons: reasons,
      shipEngineConfigured: isShipEngineConfigured(),
      order: {
        id: row.id,
        /** Human reference from `orders.order_num` (same as dashboard). */
        orderNum: row.order_num,
        displayOrderNum,
        listingTitle,
        section,
        fulfillmentMethod: row.fulfillment_method,
        deliveryStatus: row.delivery_status,
      },
      sellerAddresses,
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const raw = (await params).id
  const orderId = decodeURIComponent(typeof raw === "string" ? raw.trim() : "").trim()
  if (!orderId || !UUID_RE.test(orderId)) {
    return NextResponse.json({ error: "Invalid order" }, { status: 400 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = shippingLabelPostBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 })
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(
      "id, order_num, buyer_id, listing_id, fulfillment_method, delivery_status, shipping_address, listings ( section )",
    )
    .eq("id", orderId)
    .eq("seller_id", user.id)
    .maybeSingle()

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const o = order as {
    id: string
    order_num: string | null
    buyer_id: string
    listing_id: string
    fulfillment_method: string | null
    delivery_status: string
    shipping_address: unknown
    listings: { section: string } | { section: string }[] | null
  }

  const listing = Array.isArray(o.listings) ? o.listings[0] : o.listings
  if (!listing || !isPeerListingSection(listing.section)) {
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

  const body = parsed.data

  const sellerCtx = await loadSellerShippingLabelOrderContext(supabase, orderId, user.id)
  if (!sellerCtx.ok) {
    return NextResponse.json({ error: sellerCtx.error }, { status: sellerCtx.status })
  }

  if (body.action === "rates") {
    let sellerAddressId = body.seller_address_id?.trim() || null
    if (!sellerAddressId) {
      const { data: addrRows } = await supabase
        .from("addresses")
        .select("*")
        .eq("profile_id", user.id)
        .order("is_default", { ascending: false })
      const rows = (addrRows ?? []) as ProfileAddressRow[]
      const preferred = rows.find((r) => r.is_default) ?? rows[0]
      if (!preferred) {
        return NextResponse.json(
          { error: "Save a ship-from address on your profile first." },
          { status: 400 },
        )
      }
      sellerAddressId = preferred.id
    }

    const { data: addr, error: addrErr } = await supabase
      .from("addresses")
      .select("*")
      .eq("id", sellerAddressId)
      .eq("profile_id", user.id)
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
      const { data: listingRow, error: listingErr } = await supabase
        .from("listings")
        .select(PEER_SURFBOARD_CHECKOUT_LISTING_SELECT)
        .eq("id", o.listing_id)
        .maybeSingle()

      if (listingErr || !listingRow) {
        return NextResponse.json({ error: "Could not load listing for this order." }, { status: 500 })
      }
      const fromListing = resolveOrderLabelParcelFromListing(listingRow as ListingPackedParcelSource)
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

  return NextResponse.json(
    {
      error:
        "Payment is required before purchasing a label. Pay for the selected rate, then finalize the label purchase.",
    },
    { status: 402 },
  )
}
