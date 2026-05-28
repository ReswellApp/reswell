import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import {
  backfillMarketplaceLabelFromShipEngine,
  resolveOrderShippingLabelPdf,
} from "@/lib/services/resolveOrderShippingLabelPdf"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LABEL_BUCKET = "order-shipping-labels"

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
  const label = await resolveOrderShippingLabelPdf(serviceSupabase, {
    orderId,
    trackingNumber:
      typeof order.tracking_number === "string" ? order.tracking_number : null,
  })
  if (!label) {
    return NextResponse.json({ error: "No shipping label for this order" }, { status: 404 })
  }

  if (label.shipEngineLabel) {
    await backfillMarketplaceLabelFromShipEngine({
      supabase: serviceSupabase,
      orderId,
      label: label.shipEngineLabel,
    })
  }

  const inline = request.nextUrl.searchParams.get("inline") === "1"
  const fileName = `shipping-label-${formatOrderNumForCustomer(order.order_num, order.id)}.pdf`

  if (label.label_storage_path?.trim()) {
    const sr = createServiceRoleClient()
    const { data: blob, error: dlErr } = await sr.storage
      .from(LABEL_BUCKET)
      .download(label.label_storage_path.trim())

    if (dlErr || !blob) {
      console.error("[shipping-label download] storage:", dlErr)
      return NextResponse.json({ error: "Could not load label PDF" }, { status: 500 })
    }

    const buf = await blob.arrayBuffer()
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDispositionHeader(fileName, inline),
        "Cache-Control": "private, no-store",
      },
    })
  }

  const pdfUrl = label.label_pdf_url?.trim()
  if (!pdfUrl) {
    return NextResponse.json({ error: "No shipping label for this order" }, { status: 404 })
  }

  let pdfRes: Response
  try {
    pdfRes = await fetch(pdfUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
      headers: { Accept: "application/pdf,*/*" },
    })
  } catch (e) {
    console.error("[shipping-label download] fetch pdf:", e)
    return NextResponse.json({ error: "Could not load label PDF" }, { status: 502 })
  }

  if (!pdfRes.ok) {
    return NextResponse.json({ error: "Could not load label PDF" }, { status: 502 })
  }

  const buf = await pdfRes.arrayBuffer()
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": pdfRes.headers.get("content-type") ?? "application/pdf",
      "Content-Disposition": contentDispositionHeader(fileName, inline),
      "Cache-Control": "private, no-store",
    },
  })
}
