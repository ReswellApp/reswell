import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { getOrderDetailForAdmin } from "@/lib/db/adminOrders"
import {
  getOpenSellerSupportCaseForOrder,
  insertSupportCase,
  insertSupportCaseEvent,
  resolveSupportCaseByAnyId,
  updateSupportCaseAdmin,
} from "@/lib/db/supportCases"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { sendSupportCaseAdminReplyService } from "@/lib/services/supportCaseThread"
import { supportCaseSellerOutreachSchema } from "@/lib/validations/supportCaseSellerOutreach"

export type SellerSupportOutreachResult = {
  success: true
  sellerCaseId: string
  sellerName: string
  sellerEmail: string | null
  reused: boolean
}

export async function openSellerSupportOutreachService(
  raw: unknown,
): Promise<SellerSupportOutreachResult | { error: string }> {
  const parsed = supportCaseSellerOutreachSchema.safeParse(raw)
  if (!parsed.success) return { error: "Write a message for the seller." }

  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return { error: "Unauthorized" }

  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { error: "Seller outreach is unavailable." }
  }

  const sourceCase = await resolveSupportCaseByAnyId(
    service,
    parsed.data.source_case_id,
  )
  if (!sourceCase?.order_id) {
    return { error: "Connect an order before contacting the seller." }
  }

  const orderResult = await getOrderDetailForAdmin(service, sourceCase.order_id)
  if (orderResult.error || !orderResult.data) return { error: "Order not found." }
  const order = orderResult.data
  if (sourceCase.requester_user_id === order.seller_id) {
    return { error: "This is already the seller’s support case." }
  }

  let sellerCase = await getOpenSellerSupportCaseForOrder(
    service,
    order.id,
    order.seller_id,
  )
  const reused = Boolean(sellerCase)
  if (!sellerCase) {
    const inserted = await insertSupportCase(service, {
      kind: "order_question",
      subject: `Reswell needs information about order ${order.order_num ?? order.id.slice(0, 8)}`,
      preview: parsed.data.message,
      requester_user_id: order.seller_id,
      requester_email: order.seller.email,
      requester_role: "seller",
      order_id: order.id,
      order_ref: order.order_num,
      listing_id: order.listing_id,
      source_channel: "order_seller",
      priority: sourceCase.priority === "urgent" ? "high" : sourceCase.priority,
    })
    sellerCase = inserted.data
  }
  if (!sellerCase) return { error: "Could not open a seller support case." }

  const sent = await sendSupportCaseAdminReplyService({
    case_id: sellerCase.id,
    content: parsed.data.message,
  })
  if ("error" in sent) return { error: sent.error }

  await updateSupportCaseAdmin(service, {
    id: sellerCase.id,
    status: "waiting_on_you",
  })
  await Promise.all([
    insertSupportCaseEvent(service, {
      case_id: sourceCase.id,
      actor_admin_id: gate.ctx.user.id,
      event_type: "seller_outreach_sent",
      payload: {
        seller_case_id: sellerCase.id,
        seller_id: order.seller_id,
        order_id: order.id,
        reused,
      },
    }),
    insertSupportCaseEvent(service, {
      case_id: sellerCase.id,
      actor_admin_id: gate.ctx.user.id,
      event_type: reused ? "seller_follow_up_sent" : "seller_outreach_opened",
      payload: {
        source_case_id: sourceCase.id,
        order_id: order.id,
      },
    }),
  ])

  const sellerName =
    order.seller.display_name?.trim() ||
    order.seller.seller_slug?.trim() ||
    (order.seller.is_shop ? order.seller.shop_name?.trim() : null) ||
    order.seller.email?.trim() ||
    "Seller"

  return {
    success: true,
    sellerCaseId: sellerCase.id,
    sellerName,
    sellerEmail: order.seller.email,
    reused,
  }
}
