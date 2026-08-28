import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { loadShippingLabelPdfBytes } from "@/lib/services/resolveOrderShippingLabelPdf"
import { listOrderShippingLabelsForOrder } from "@/lib/db/orderShippingLabels"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function contentDispositionHeader(fileName: string, inline: boolean): string {
  const fallback = "shipping-label.pdf"
  const safe = fileName.replace(/["\r\n\\]/g, "_").trim().slice(0, 200) || fallback
  const star = encodeURIComponent(safe)
  const mode = inline ? "inline" : "attachment"
  return `${mode}; filename="${safe}"; filename*=UTF-8''${star}`
}

/**
 * GET /api/orders/:id/shipping-label/download
 *
 * Seller-only download/view for a prepared Reswell or admin shipping label PDF.
 * Optional `label_id` selects a specific marketplace label when the order has multiple packages.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await context.params
  if (!orderId?.trim() || !UUID_RE.test(orderId)) {
    return NextResponse.json({ error: "Invalid order" }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, order_num, seller_id, tracking_number")
    .eq("id", orderId)
    .eq("seller_id", user.id)
    .maybeSingle()

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const serviceSupabase = createServiceRoleClient()
  const labelIdParam = request.nextUrl.searchParams.get("label_id")?.trim() || null
  let trackingForLoad =
    typeof order.tracking_number === "string" ? order.tracking_number : null
  let labelId: string | null = null

  if (labelIdParam && UUID_RE.test(labelIdParam)) {
    const labels = await listOrderShippingLabelsForOrder(serviceSupabase, orderId)
    const match = labels.find((l) => l.id === labelIdParam)
    if (!match) {
      return NextResponse.json({ error: "No shipping label for this order" }, { status: 404 })
    }
    trackingForLoad = match.tracking_number
    labelId = match.id
  }

  const loaded = await loadShippingLabelPdfBytes(serviceSupabase, {
    orderId,
    trackingNumber: trackingForLoad,
    labelId,
  })
  if (!loaded.ok) {
    if (loaded.reason === "not_found") {
      return NextResponse.json({ error: "No shipping label for this order" }, { status: 404 })
    }
    return NextResponse.json(
      { error: "Could not load label PDF" },
      { status: loaded.reason === "fetch" ? 502 : 500 },
    )
  }

  const inline = request.nextUrl.searchParams.get("inline") === "1"
  const fileName = `shipping-label-${formatOrderNumForCustomer(order.order_num, order.id)}.pdf`

  return new NextResponse(Buffer.from(loaded.bytes), {
    status: 200,
    headers: {
      "Content-Type": loaded.contentType,
      "Content-Disposition": contentDispositionHeader(fileName, inline),
      "Cache-Control": "private, no-store",
    },
  })
}
