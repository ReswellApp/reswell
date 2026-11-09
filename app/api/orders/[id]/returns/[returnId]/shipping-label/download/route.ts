import { NextRequest, NextResponse } from "next/server"
import { loadMarketplaceOrderAccess } from "@/lib/account-access/order-operator-session"
import { z } from "zod"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { getOrderItemReturnById, returnHasLabelPdf } from "@/lib/db/orderItemReturns"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { fetchSantaBarbaraDropoffOrderIds } from "@/lib/services/santaBarbaraDropoffOrderAccess"

export const dynamic = "force-dynamic"

const uuidSchema = z.string().uuid()
const LABEL_BUCKET = "order-shipping-labels"

function contentDispositionHeader(fileName: string, inline: boolean): string {
  const fallback = "return-shipping-label.pdf"
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

  const access = await loadMarketplaceOrderAccess(supabase, id)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const service = createServiceRoleClient()
  if (
    access.role === "seller" &&
    (await fetchSantaBarbaraDropoffOrderIds(service, [id])).has(id)
  ) {
    return NextResponse.json({ error: "No return label found" }, { status: 404 })
  }

  const row = await getOrderItemReturnById(service, returnId)
  if (!row || row.order_id !== id || !returnHasLabelPdf(row)) {
    return NextResponse.json({ error: "No return label found" }, { status: 404 })
  }

  const { data: orderMeta } = await service
    .from("orders")
    .select("order_num")
    .eq("id", id)
    .maybeSingle()
  const inline = request.nextUrl.searchParams.get("inline") === "1"
  const fileName = `return-label-${formatOrderNumForCustomer(
    typeof orderMeta?.order_num === "string" ? orderMeta.order_num : null,
    id,
  )}.pdf`

  if (row.label_storage_path?.trim()) {
    const { data: blob, error: dlErr } = await service.storage
      .from(LABEL_BUCKET)
      .download(row.label_storage_path.trim())
    if (dlErr || !blob) {
      return NextResponse.json({ error: "Could not load return label" }, { status: 500 })
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

  const pdfUrl = row.label_pdf_url?.trim()
  if (!pdfUrl) {
    return NextResponse.json({ error: "No return label found" }, { status: 404 })
  }

  let pdfRes: Response
  try {
    pdfRes = await fetch(pdfUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
      headers: { Accept: "application/pdf,*/*" },
    })
  } catch {
    return NextResponse.json({ error: "Could not load return label" }, { status: 502 })
  }
  if (!pdfRes.ok) {
    return NextResponse.json({ error: "Could not load return label" }, { status: 502 })
  }

  return new NextResponse(pdfRes.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDispositionHeader(fileName, inline),
      "Cache-Control": "private, no-store",
    },
  })
}
