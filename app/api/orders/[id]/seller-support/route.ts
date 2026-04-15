import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"

const schema = z.object({
  request_type: z.enum(["refund_request", "cancel_request", "return_request"]),
  body: z.string().min(10).max(8000),
})

export const dynamic = "force-dynamic"

/**
 * POST /api/orders/:id/seller-support
 *
 * Sellers submit refund / cancel / return requests for admin review.
 * Inserts into `order_support_requests` via service role (RLS on that table
 * only allows the buyer; sellers use this authenticated path instead).
 */
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

  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 })
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, order_num, status, seller_id")
    .eq("id", orderId)
    .eq("seller_id", user.id)
    .maybeSingle()

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  if (order.status === "refunded") {
    return NextResponse.json({ error: "This order is already refunded" }, { status: 409 })
  }

  const orderRef = formatOrderNumForCustomer(
    (order as { order_num?: string | null }).order_num ?? null,
    orderId,
  )

  const serviceSupabase = createServiceRoleClient()
  const { data, error } = await serviceSupabase
    .from("order_support_requests")
    .insert({
      order_id: orderId,
      buyer_id: user.id,
      request_type: "help",
      body: `[Seller ${parsed.data.request_type.replace(/_/g, " ")}]\n\n${parsed.data.body.trim()}`,
      contacted_seller_first: null,
      order_ref: orderRef,
    })
    .select("id")
    .single()

  if (error || !data) {
    console.error("[seller-support] insert:", error)
    return NextResponse.json({ error: "Could not submit request" }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: data.id })
}
