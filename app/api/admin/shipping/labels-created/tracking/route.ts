import { createServiceRoleClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { attachAdminShippingLabelToOrder } from "@/lib/services/adminOrderShippingLabelNotify"
import { PEER_SURFBOARD_CHECKOUT_LISTING_SELECT } from "@/lib/services/peerListingShippingQuote"
import { adminShippingManualTrackingBodySchema } from "@/lib/validations/admin-shipping-labels"

export const dynamic = "force-dynamic"

/**
 * POST /api/admin/shipping/labels-created/tracking
 *
 * Fallback: set tracking on the order for buyer visibility without buying a label.
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

  const parsed = adminShippingManualTrackingBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 })
  }

  const { order_id: orderId, tracking_number, tracking_carrier } = parsed.data
  const supabase = createServiceRoleClient()

  const { data: order, error: ordErr } = await supabase
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
      listings (
        ${PEER_SURFBOARD_CHECKOUT_LISTING_SELECT}
      )
    `,
    )
    .eq("id", orderId)
    .maybeSingle()

  if (ordErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const o = order as unknown as {
    order_num: string | null
    buyer_id: string
    seller_id: string
    listing_id: string
    fulfillment_method: string | null
    delivery_status: string
    listings: Record<string, unknown> | Record<string, unknown>[] | null
  }

  if (o.fulfillment_method !== "shipping") {
    return NextResponse.json({ error: "Order is not a shipping order" }, { status: 400 })
  }
  if (o.delivery_status !== "pending") {
    return NextResponse.json(
      { error: "Tracking can only be added while the order is awaiting shipment." },
      { status: 409 },
    )
  }

  const listing = Array.isArray(o.listings) ? o.listings[0] : o.listings
  if (!listing || (listing as { section?: string }).section !== "surfboards") {
    return NextResponse.json({ error: "Tracking tool is for surfboard shipping orders." }, { status: 400 })
  }

  const listingTitle =
    typeof (listing as { title?: string }).title === "string"
      ? (listing as { title: string }).title.trim() || "Item"
      : "Item"

  const attached = await attachAdminShippingLabelToOrder({
    supabase,
    adminUserId: gate.ctx.user.id,
    order: {
      id: orderId,
      buyer_id: o.buyer_id,
      seller_id: o.seller_id,
      listing_id: o.listing_id,
    },
    listingTitle,
    displayOrderNum: formatOrderNumForCustomer(o.order_num, orderId),
    source: "manual_tracking_buyer",
    labelPdfUrl: null,
    labelStoragePath: null,
    trackingNumber: tracking_number,
    trackingCarrier: tracking_carrier?.trim() || null,
  })

  if (!attached.ok) {
    return NextResponse.json({ error: attached.error }, { status: attached.status })
  }

  return NextResponse.json({ success: true })
}
