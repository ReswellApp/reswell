import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import {
  backfillMarketplaceLabelFromShipEngine,
  resolveOrderShippingLabelPdf,
} from "@/lib/services/resolveOrderShippingLabelPdf"

const orderIdSchema = z.string().uuid()
const LABEL_BUCKET = "order-shipping-labels"

function contentDispositionHeader(fileName: string, inline: boolean): string {
  const fallback = "shipping-label.pdf"
  const safe = fileName.replace(/["\r\n\\]/g, "_").trim().slice(0, 200) || fallback
  const star = encodeURIComponent(safe)
  const mode = inline ? "inline" : "attachment"
  return `${mode}; filename="${safe}"; filename*=UTF-8''${star}`
}

/**
 * GET /api/admin/orders/:id/shipping-label/download
 *
 * Admin/support view or download for a prepared Reswell or admin shipping label PDF.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) {
    return gate.response
  }

  const parsed = orderIdSchema.safeParse((await context.params).id)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 })
  }

  const orderId = parsed.data
  const serviceSupabase = createServiceRoleClient()
  const { data: order, error: orderErr } = await serviceSupabase
    .from("orders")
    .select("id, order_num, tracking_number")
    .eq("id", orderId)
    .maybeSingle()

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

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
    const { data: blob, error: dlErr } = await serviceSupabase.storage
      .from(LABEL_BUCKET)
      .download(label.label_storage_path.trim())

    if (dlErr || !blob) {
      console.error("[admin shipping-label download] storage:", dlErr)
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
    console.error("[admin shipping-label download] fetch pdf:", e)
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
