import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { authorizeDropoffLocationLabelDownload } from "@/lib/services/dropoffLocationDashboard"
import {
  backfillMarketplaceLabelFromShipEngine,
  resolveOrderShippingLabelPdf,
} from "@/lib/services/resolveOrderShippingLabelPdf"
import { createServiceRoleClient } from "@/lib/supabase/server"

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
 * GET /api/dropoff-location/orders/:id/shipping-label/download
 *
 * The granted dropoff account for this order's location can open the carrier label.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const parsed = orderIdSchema.safeParse((await context.params).id)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 })
  }

  const allowed = await authorizeDropoffLocationLabelDownload(parsed.data)
  if (!allowed.ok) {
    if (allowed.status === 401) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 })
    }
    if (allowed.status === 500) {
      return NextResponse.json({ error: "Could not load label PDF" }, { status: 500 })
    }
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const serviceSupabase = createServiceRoleClient()
  const label = await resolveOrderShippingLabelPdf(serviceSupabase, {
    orderId: allowed.orderId,
    trackingNumber: allowed.trackingNumber,
  })
  if (!label) {
    return NextResponse.json({ error: "No shipping label for this order" }, { status: 404 })
  }

  if (label.shipEngineLabel) {
    await backfillMarketplaceLabelFromShipEngine({
      supabase: serviceSupabase,
      orderId: allowed.orderId,
      label: label.shipEngineLabel,
    })
  }

  const inline = request.nextUrl.searchParams.get("inline") === "1"
  const fileName = `shipping-label-${formatOrderNumForCustomer(allowed.orderNum, allowed.orderId)}.pdf`

  if (label.label_storage_path?.trim()) {
    const { data: blob, error: dlErr } = await serviceSupabase.storage
      .from(LABEL_BUCKET)
      .download(label.label_storage_path.trim())

    if (dlErr || !blob) {
      console.error("[dropoff shipping-label download] storage:", dlErr)
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
  } catch (error) {
    console.error("[dropoff shipping-label download] fetch pdf:", error)
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
