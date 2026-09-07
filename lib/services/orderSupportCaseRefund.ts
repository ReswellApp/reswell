import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { getOrderSupportRequestById, updateOrderSupportRequestAdmin } from "@/lib/db/order-support"
import {
  getSupportCaseById,
  getSupportCaseByOrderSupportId,
  insertSupportCaseEvent,
  resolveSupportCaseByAnyId,
  updateSupportCaseAdmin,
} from "@/lib/db/supportCases"
import { issueMarketplaceOrderRefund } from "@/lib/services/issueMarketplaceOrderRefund"
import { emitKlaviyoOrderRefundedForOrder } from "@/lib/services/klaviyoOrderRefunded"
import { sendSupportCaseAdminReplyService } from "@/lib/services/supportCaseThread"
import { issueOrderSupportCaseRefundSchema } from "@/lib/validations/orderSupportCaseRefund"

export async function issueOrderSupportCaseRefundService(
  raw: unknown,
): Promise<
  | {
      success: true
      message: string
      fullyRefundedInApp: boolean
    }
  | { error: string }
> {
  const parsed = issueOrderSupportCaseRefundSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid input" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.is_admin !== true) {
    return { error: "Only admins can issue a refund from a case." }
  }

  const resolvedCase =
    (await resolveSupportCaseByAnyId(supabase, parsed.data.case_id)) ??
    (await getSupportCaseById(supabase, parsed.data.case_id))
  const sidecarId = resolvedCase?.order_support_request_id ?? parsed.data.case_id
  const row = await getOrderSupportRequestById(supabase, sidecarId)
  if (!row) return { error: "Case not found" }
  if (row.order_id !== parsed.data.order_id) {
    return { error: "This case is not linked to that order." }
  }

  const repairCredit = row.repair_credit_total ?? 0
  if (repairCredit > 0 && parsed.data.allow_after_repair_credit !== true) {
    return {
      error: `This case already has $${repairCredit.toFixed(2)} in repair credit. Confirm to also refund the order — that can double-pay the buyer.`,
    }
  }

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    return { error: "Refunds are not available in this environment." }
  }

  const { data: order, error: fetchErr } = await service
    .from("orders")
    .select(
      "id, seller_id, buyer_id, listing_id, amount, seller_earnings, status, payment_method, stripe_checkout_session_id, refund_disposition",
    )
    .eq("id", row.order_id)
    .single()

  if (fetchErr || !order) return { error: "Order not found" }

  const result = await issueMarketplaceOrderRefund(service, order, {
    disposition: order.status === "refunding" ? undefined : parsed.data.disposition,
  })

  if (!result.ok) return { error: result.error }

  if (result.fullyRefundedInApp) {
    await emitKlaviyoOrderRefundedForOrder(service, row.order_id, {
      refundType: result.refund_type,
      source: "case_desk",
    })
  }

  await updateOrderSupportRequestAdmin(service, {
    id: row.id,
    support_status: result.fullyRefundedInApp ? "resolved" : "investigating",
    outcome: result.fullyRefundedInApp ? "approved" : row.outcome,
  })

  const shadow = await getSupportCaseByOrderSupportId(service, row.id)
  if (shadow) {
    await updateSupportCaseAdmin(service, {
      id: shadow.id,
      status: result.fullyRefundedInApp ? "resolved" : "in_progress",
      outcome: result.fullyRefundedInApp ? "approved" : shadow.outcome,
    })
    await insertSupportCaseEvent(service, {
      case_id: shadow.id,
      actor_admin_id: user.id,
      event_type: "order_refunded",
      payload: {
        order_id: row.order_id,
        disposition: parsed.data.disposition,
        repair_credit_total: repairCredit,
        allow_after_repair_credit: parsed.data.allow_after_repair_credit === true,
        message: result.message,
      },
    })
  }

  if (parsed.data.notify_customer !== false && (resolvedCase?.id || shadow?.id)) {
    const notify = await sendSupportCaseAdminReplyService({
      case_id: resolvedCase?.id ?? shadow?.id,
      content: `We’ve issued a refund for order ${row.order_ref}. ${result.message}`,
    })
    if ("error" in notify) {
      console.warn("[issueOrderSupportCaseRefund] notify:", notify.error)
    }
  }

  return {
    success: true,
    message: result.message,
    fullyRefundedInApp: result.fullyRefundedInApp,
  }
}
