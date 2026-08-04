import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { resolveOrderShippingLabelPaperless } from "@/lib/services/resolveOrderShippingLabelPaperless"

const orderIdSchema = z.string().uuid()
const LABEL_BUCKET = "order-shipping-labels"

function contentDispositionHeader(fileName: string, inline: boolean): string {
  const fallback = "shipping-label-qr.png"
  const safe = fileName.replace(/["\r\n\\]/g, "_").trim().slice(0, 200) || fallback
  const star = encodeURIComponent(safe)
  const mode = inline ? "inline" : "attachment"
  return `${mode}; filename="${safe}"; filename*=UTF-8''${star}`
}

/**
 * GET /api/admin/orders/:id/shipping-label/qr
 *
 * Admin/support view for a USPS Label Broker / paperless QR image.
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
    .select("id, order_num")
    .eq("id", orderId)
    .maybeSingle()

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

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
      console.error("[admin shipping-label qr] storage:", dlErr)
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
    console.error("[admin shipping-label qr] fetch:", e)
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
