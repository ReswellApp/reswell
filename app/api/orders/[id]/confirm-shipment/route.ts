import { createClient } from "@/lib/supabase/server"
import { loadOrderOperator } from "@/lib/account-access/order-operator-session"
import { NextRequest, NextResponse } from "next/server"
import { markOrderDispatchedBySeller } from "@/lib/services/markOrderShipped"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/orders/:id/confirm-shipment
 *
 * Seller confirms the package was handed to the carrier after tracking exists on the order.
 */
export async function POST(
  _request: NextRequest,
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

  const operating = await loadOrderOperator()
  if (!operating.ok) {
    return NextResponse.json({ error: operating.error }, { status: operating.status })
  }

  const { data: order, error: fetchErr } = await supabase
    .from("orders")
    .select("id, seller_id, buyer_id, listing_id, fulfillment_method, delivery_status")
    .eq("id", orderId)
    .in("seller_id", operating.operator.sellerIds)
    .maybeSingle()

  if (fetchErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  if (order.fulfillment_method !== "shipping") {
    return NextResponse.json({ error: "Only shipping orders use this step." }, { status: 400 })
  }

  const result = await markOrderDispatchedBySeller(
    supabase,
    {
      id: order.id,
      buyer_id: order.buyer_id,
      listing_id: order.listing_id,
    },
    String(order.seller_id),
  )

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true })
}
