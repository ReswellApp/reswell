import { NextResponse } from "next/server"
import { loadMarketplaceOrderAccess } from "@/lib/account-access/order-operator-session"
import { z } from "zod"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { listOrderItemReturnsForOrder } from "@/lib/db/orderItemReturns"
import { returnHasLabelPdf, returnHasPaperlessQr } from "@/lib/db/orderItemReturns"
import { fetchSantaBarbaraDropoffOrderIds } from "@/lib/services/santaBarbaraDropoffOrderAccess"

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

  const access = await loadMarketplaceOrderAccess(supabase, parsed.data)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const service = createServiceRoleClient()
  const returns = await listOrderItemReturnsForOrder(service, parsed.data)
  const sellerView = access.role === "seller"
  const hideLabelsFromSeller =
    sellerView && (await fetchSantaBarbaraDropoffOrderIds(service, [parsed.data])).has(parsed.data)

  return NextResponse.json({
    data: {
      role: access.role,
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
        paperless_instructions: hideLabelsFromSeller ? null : r.paperless_instructions,
        paperless_handoff_code: hideLabelsFromSeller ? null : r.paperless_handoff_code,
        has_label_pdf: hideLabelsFromSeller ? false : returnHasLabelPdf(r),
        has_paperless_qr: hideLabelsFromSeller ? false : returnHasPaperlessQr(r),
        created_at: r.created_at,
      })),
    },
  })
}
