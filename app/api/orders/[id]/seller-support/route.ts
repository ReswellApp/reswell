import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { insertOrderSupportRequest } from "@/lib/db/order-support"
import { insertSupportCase, insertSupportCaseMessage } from "@/lib/db/supportCases"
import { linkOrderSupportThread } from "@/lib/services/orderSupportThread"
import { trackKlaviyoSupportTicketCreated } from "@/lib/klaviyo/track-support-ticket"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { orderRequestTypeSubject, orderRequestTypeToKind } from "@/lib/utils/support-case-display"

const schema = z.object({
  request_type: z.enum(["refund_request", "cancel_request"]),
  body: z.string().min(10).max(8000),
})

export const dynamic = "force-dynamic"

/**
 * POST /api/orders/:id/seller-support
 * Sellers open order help cases (refund or cancel request) for admin review.
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

  if (order.status === "refunding") {
    return NextResponse.json({ error: "A refund is already in progress for this order" }, { status: 409 })
  }

  const orderRef = formatOrderNumForCustomer(
    (order as { order_num?: string | null }).order_num ?? null,
    orderId,
  )

  const mappedType =
    parsed.data.request_type === "cancel_request" ? "cancel_order" : "help"

  const serviceSupabase = createServiceRoleClient()
  const { data, error } = await insertOrderSupportRequest(serviceSupabase, {
    order_id: orderId,
    buyer_id: user.id,
    request_type: mappedType,
    body: parsed.data.body.trim(),
    contacted_seller_first: null,
    order_ref: orderRef,
    requester_role: "seller",
  })

  if (error || !data) {
    console.error("[seller-support] insert:", error)
    return NextResponse.json({ error: "Could not submit request" }, { status: 500 })
  }

  const kind = orderRequestTypeToKind(mappedType)
  const subject = `[Seller] ${orderRequestTypeSubject(mappedType, orderRef)}`
  const dual = await insertSupportCase(serviceSupabase, {
    kind,
    subject,
    preview: parsed.data.body.trim(),
    requester_user_id: user.id,
    requester_email: user.email ?? null,
    requester_role: "seller",
    order_id: orderId,
    order_ref: orderRef,
    order_support_request_id: data.id,
    source_channel: "order_seller",
    priority: "high",
  })
  if (dual.data) {
    await insertSupportCaseMessage(serviceSupabase, {
      case_id: dual.data.id,
      author_user_id: user.id,
      author_role: "customer",
      body: parsed.data.body.trim(),
    })
  }

  const linked = await linkOrderSupportThread(data)
  if ("error" in linked) {
    console.warn("[seller-support] thread link:", linked.error)
  }

  await trackKlaviyoSupportTicketCreated({
    supportTicketId: data.id,
    email: user.email ?? "",
    externalId: user.id,
    source: "order_seller_support",
    subject: parsed.data.request_type,
    message: parsed.data.body.trim(),
    orderRef: orderRef,
  })

  return NextResponse.json({ success: true, id: data.id })
}
