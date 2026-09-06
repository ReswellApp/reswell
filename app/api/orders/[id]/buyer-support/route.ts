import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { insertOrderSupportRequest } from "@/lib/db/order-support"
import { insertSupportCase, insertSupportCaseMessage } from "@/lib/db/supportCases"
import { insertSupportCaseAttachments } from "@/lib/db/supportCaseAttachments"
import { linkOrderSupportThread } from "@/lib/services/orderSupportThread"
import { trackKlaviyoSupportTicketCreated } from "@/lib/klaviyo/track-support-ticket"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { validateBuyerSupportForOrder } from "@/lib/services/orderBuyerSupport"
import { orderBuyerSupportRequestSchema } from "@/lib/validations/order-buyer-support"
import { orderRequestTypeSubject, orderRequestTypeToKind } from "@/lib/utils/support-case-display"

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
    requester_role: "buyer",
  })

  if (error || !data) {
    console.error("[buyer-support] insert:", error)
    return NextResponse.json({ error: "Could not submit request" }, { status: 500 })
  }

  // Dual-write into unified support_cases (soft-fail if migration not applied yet)
  const kind = orderRequestTypeToKind(parsed.data.request_type)
  const subject = orderRequestTypeSubject(parsed.data.request_type, orderRef)
  const service = createServiceRoleClient()
  const dual = await insertSupportCase(service, {
    kind,
    subject,
    preview: parsed.data.body.trim(),
    requester_user_id: user.id,
    requester_email: user.email ?? null,
    requester_role: "buyer",
    order_id: orderId,
    order_ref: orderRef,
    order_support_request_id: data.id,
    source_channel: "order_buyer",
    priority: kind === "protection_claim" ? "high" : "normal",
  })
  if (dual.data) {
    await insertSupportCaseMessage(service, {
      case_id: dual.data.id,
      author_user_id: user.id,
      author_role: "customer",
      body: parsed.data.body.trim(),
    })
  }

  if (parsed.data.request_type === "refund_help" && parsed.data.evidence?.length) {
    const attached = await insertSupportCaseAttachments(service, {
      orderSupportRequestId: data.id,
      supportCaseId: dual.data?.id ?? null,
      uploadedBy: user.id,
      attachments: parsed.data.evidence,
    })
    if (attached.error) {
      console.warn("[buyer-support] evidence:", attached.error.message)
    }
  }

  // Open Help thread so the member can reply under Dashboard → Help
  const linked = await linkOrderSupportThread(data)
  if ("error" in linked) {
    console.warn("[buyer-support] thread link:", linked.error)
  }

  await trackKlaviyoSupportTicketCreated({
    supportTicketId: data.id,
    email: user.email ?? "",
    externalId: user.id,
    source: "order_buyer_support",
    subject: parsed.data.request_type,
    message: parsed.data.body.trim(),
    orderRef: orderRef,
  })

  return NextResponse.json({ success: true, id: data.id })
}
