import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { insertOrderSupportRequest } from "@/lib/db/order-support"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { validateBuyerSupportForOrder } from "@/lib/services/orderBuyerSupport"
import { orderBuyerSupportRequestSchema } from "@/lib/validations/order-buyer-support"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = orderBuyerSupportRequestSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 })
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, order_num, status, delivery_status, fulfillment_method")
    .eq("id", orderId)
    .eq("buyer_id", user.id)
    .maybeSingle()

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const gate = validateBuyerSupportForOrder(order, parsed.data)
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: 400 })
  }

  const contacted =
    parsed.data.request_type === "refund_help" ? parsed.data.contacted_seller_first : null

  const orderRef = formatOrderNumForCustomer(
    (order as { order_num?: string | null }).order_num ?? null,
    orderId,
  )

  const { data, error } = await insertOrderSupportRequest(supabase, {
    order_id: orderId,
    buyer_id: user.id,
    request_type: parsed.data.request_type,
    body: parsed.data.body.trim(),
    contacted_seller_first: contacted,
    order_ref: orderRef,
  })

  if (error || !data) {
    console.error("[buyer-support] insert:", error)
    return NextResponse.json({ error: "Could not submit request" }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: data.id })
}
