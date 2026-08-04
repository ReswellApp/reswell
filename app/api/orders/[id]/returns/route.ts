import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { listOrderItemReturnsForOrder } from "@/lib/db/orderItemReturns"
import { returnHasLabelPdf, returnHasPaperlessQr } from "@/lib/db/orderItemReturns"

export const dynamic = "force-dynamic"

const orderIdSchema = z.string().uuid()

/**
 * GET /api/orders/:id/returns
 * Buyer or seller: list returns for an order (label/QR availability + status).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const parsed = orderIdSchema.safeParse((await context.params).id)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 })
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
    .select("id, buyer_id, seller_id")
    .eq("id", parsed.data)
    .maybeSingle()

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const row = order as { id: string; buyer_id: string; seller_id: string }
  if (row.buyer_id !== user.id && row.seller_id !== user.id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const service = createServiceRoleClient()
  const returns = await listOrderItemReturnsForOrder(service, parsed.data)

  return NextResponse.json({
    data: {
      role: row.buyer_id === user.id ? "buyer" : "seller",
      returns: returns.map((r) => ({
        id: r.id,
        listing_id: r.listing_id,
        order_item_id: r.order_item_id,
        status: r.status,
        refund_amount_usd: Number(r.refund_amount_usd),
        tracking_number: r.tracking_number,
        tracking_carrier: r.tracking_carrier,
        carrier_delivered_at: r.carrier_delivered_at,
        refunded_at: r.refunded_at,
        paperless_instructions: r.paperless_instructions,
        paperless_handoff_code: r.paperless_handoff_code,
        has_label_pdf: returnHasLabelPdf(r),
        has_paperless_qr: returnHasPaperlessQr(r),
        created_at: r.created_at,
      })),
    },
  })
}
