import { randomUUID } from "node:crypto"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { attachAdminShippingLabelToOrder } from "@/lib/services/adminOrderShippingLabelNotify"
import { PEER_SURFBOARD_CHECKOUT_LISTING_SELECT } from "@/lib/services/peerListingShippingQuote"
import { isPeerListingSection } from "@/lib/peer-listing-sections"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const dynamic = "force-dynamic"

const MAX_BYTES = 15 * 1024 * 1024

/**
 * POST /api/admin/shipping/labels-created/upload
 *
 * multipart/form-data: order_id (uuid), file (application/pdf)
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const orderId = String(form.get("order_id") ?? "").trim()
  const file = form.get("file")

  if (!orderId || !UUID_RE.test(orderId)) {
    return NextResponse.json({ error: "Invalid order_id" }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing PDF file" }, { status: 400 })
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF uploads are allowed" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 15 MB)" }, { status: 400 })
  }

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
      { error: "Order is not awaiting shipment — label upload is for pending shipments only." },
      { status: 409 },
    )
  }

  const listing = Array.isArray(o.listings) ? o.listings[0] : o.listings
  if (!listing || !isPeerListingSection((listing as { section?: string }).section)) {
    return NextResponse.json(
      { error: "Labels are for marketplace shipping orders only." },
      { status: 400 },
    )
  }

  const listingTitle =
    typeof (listing as { title?: string }).title === "string"
      ? (listing as { title: string }).title.trim() || "Item"
      : "Item"

  const buf = Buffer.from(await file.arrayBuffer())
  const path = `${orderId}/${randomUUID()}.pdf`

  const { error: upErr } = await supabase.storage.from("order-shipping-labels").upload(path, buf, {
    contentType: "application/pdf",
    upsert: false,
  })

  if (upErr) {
    console.error("[labels-created upload]", upErr)
    return NextResponse.json({ error: "Could not store PDF" }, { status: 500 })
  }

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
    source: "manual_label_upload",
    labelPdfUrl: null,
    labelStoragePath: path,
    trackingNumber: null,
    trackingCarrier: null,
  })

  if (!attached.ok) {
    return NextResponse.json({ error: attached.error }, { status: attached.status })
  }

  return NextResponse.json({
    success: true,
    data: { order_id: orderId, storage_path: path },
  })
}
