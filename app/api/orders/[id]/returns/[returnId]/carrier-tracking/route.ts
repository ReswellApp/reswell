import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { getOrderReturnCarrierTracking } from "@/lib/services/orderReturnCarrierTracking"

export const dynamic = "force-dynamic"

const uuidSchema = z.string().uuid()

/**
 * GET /api/orders/:id/returns/:returnId/carrier-tracking
 * Buyer/seller live return shipment tracking (timeline events).
 */
export async function GET(
  _request: Request,
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
    .select("id, buyer_id, seller_id")
    .eq("id", id)
    .maybeSingle()

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const orderRow = order as { id: string; buyer_id: string; seller_id: string }
  if (orderRow.buyer_id !== user.id && orderRow.seller_id !== user.id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const service = createServiceRoleClient()
  const result = await getOrderReturnCarrierTracking({
    supabase: service,
    orderId: id,
    returnId,
  })

  if (result.fetchError === "Return not found") {
    return NextResponse.json({ error: "Return not found" }, { status: 404 })
  }

  return NextResponse.json({
    data: result.data,
    live: result.live,
    fetchError: result.fetchError,
    marketplace: result.marketplace,
  })
}
