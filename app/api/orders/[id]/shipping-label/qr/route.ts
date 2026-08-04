import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { resolveOrderShippingLabelPaperless } from "@/lib/services/resolveOrderShippingLabelPaperless"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LABEL_BUCKET = "order-shipping-labels"

function contentDispositionHeader(fileName: string, inline: boolean): string {
  const fallback = "shipping-label-qr.png"
  const safe = fileName.replace(/["\r\n\\]/g, "_").trim().slice(0, 200) || fallback
  const star = encodeURIComponent(safe)
  const mode = inline ? "inline" : "attachment"
  return `${mode}; filename="${safe}"; filename*=UTF-8''${star}`
}

/**
 * GET /api/orders/:id/shipping-label/qr
 *
 * Seller-only view for a USPS Label Broker / paperless QR image.
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
    .select("id, order_num, seller_id")
    .eq("id", orderId)
    .eq("seller_id", user.id)
    .maybeSingle()

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const serviceSupabase = createServiceRoleClient()
  const label = await resolveOrderShippingLabelPaperless(serviceSupabase, orderId)
  if (!label) {
    return NextResponse.json({ error: "No paperless QR for this order" }, { status: 404 })
  }

  const inline = request.nextUrl.searchParams.get("inline") !== "0"
  const fileName = `shipping-label-qr-${formatOrderNumForCustomer(order.order_num, order.id)}.png`

  if (label.paperless_qr_storage_path?.trim()) {
    const { data: blob, error: dlErr } = await serviceSupabase.storage
      .from(LABEL_BUCKET)
      .download(label.paperless_qr_storage_path.trim())

    if (dlErr || !blob) {
      console.error("[shipping-label qr] storage:", dlErr)
      return NextResponse.json({ error: "Could not load paperless QR" }, { status: 500 })
    }

    const buf = await blob.arrayBuffer()
    const contentType = blob.type?.startsWith("image/") ? blob.type : "image/png"
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDispositionHeader(fileName, inline),
        "Cache-Control": "private, no-store",
      },
    })
  }

  const qrUrl = label.paperless_qr_url?.trim()
  if (!qrUrl) {
    return NextResponse.json({ error: "No paperless QR for this order" }, { status: 404 })
  }

  let qrRes: Response
  try {
    qrRes = await fetch(qrUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
      headers: { Accept: "image/png,image/jpeg,image/*,*/*" },
    })
  } catch (e) {
    console.error("[shipping-label qr] fetch:", e)
    return NextResponse.json({ error: "Could not load paperless QR" }, { status: 502 })
  }

  if (!qrRes.ok) {
    return NextResponse.json({ error: "Could not load paperless QR" }, { status: 502 })
  }

  const buf = await qrRes.arrayBuffer()
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": qrRes.headers.get("content-type") ?? "image/png",
      "Content-Disposition": contentDispositionHeader(fileName, inline),
      "Cache-Control": "private, no-store",
    },
  })
}
