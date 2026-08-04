import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { getOrderItemReturnById } from "@/lib/db/orderItemReturns"
import { resolveOrderReturnLabelPaperless } from "@/lib/services/resolveOrderReturnLabelPaperless"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"

export const dynamic = "force-dynamic"

const uuidSchema = z.string().uuid()
const LABEL_BUCKET = "order-shipping-labels"

function contentDispositionHeader(fileName: string, inline: boolean): string {
  const fallback = "return-label-qr.png"
  const safe = fileName.replace(/["\r\n\\]/g, "_").trim().slice(0, 200) || fallback
  const star = encodeURIComponent(safe)
  const mode = inline ? "inline" : "attachment"
  return `${mode}; filename="${safe}"; filename*=UTF-8''${star}`
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; returnId: string }> },
) {
  const { id, returnId } = await context.params
  if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(returnId).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_num, buyer_id, seller_id")
    .eq("id", id)
    .maybeSingle()

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const orderRow = order as {
    id: string
    order_num: string | null
    buyer_id: string
    seller_id: string
  }
  if (orderRow.buyer_id !== user.id && orderRow.seller_id !== user.id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const service = createServiceRoleClient()
  const row = await getOrderItemReturnById(service, returnId)
  if (!row || row.order_id !== id) {
    return NextResponse.json({ error: "Return not found" }, { status: 404 })
  }

  const label = await resolveOrderReturnLabelPaperless(service, returnId)
  if (!label) {
    return NextResponse.json({ error: "No paperless QR for this return" }, { status: 404 })
  }

  const inline = request.nextUrl.searchParams.get("inline") !== "0"
  const fileName = `return-label-qr-${formatOrderNumForCustomer(orderRow.order_num, orderRow.id)}.png`

  if (label.paperless_qr_storage_path?.trim()) {
    const { data: blob, error: dlErr } = await service.storage
      .from(LABEL_BUCKET)
      .download(label.paperless_qr_storage_path.trim())
    if (dlErr || !blob) {
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
    return NextResponse.json({ error: "No paperless QR for this return" }, { status: 404 })
  }

  let qrRes: Response
  try {
    qrRes = await fetch(qrUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
      headers: { Accept: "image/png,image/jpeg,image/*,*/*" },
    })
  } catch {
    return NextResponse.json({ error: "Could not load paperless QR" }, { status: 502 })
  }
  if (!qrRes.ok) {
    return NextResponse.json({ error: "Could not load paperless QR" }, { status: 502 })
  }

  return new NextResponse(qrRes.body, {
    status: 200,
    headers: {
      "Content-Type": qrRes.headers.get("content-type") || "image/png",
      "Content-Disposition": contentDispositionHeader(fileName, inline),
      "Cache-Control": "private, no-store",
    },
  })
}
