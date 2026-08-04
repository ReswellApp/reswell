import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { issueMarketplaceOrderRefund } from "@/lib/services/issueMarketplaceOrderRefund"
import { emitKlaviyoOrderRefundedForOrder } from "@/lib/services/klaviyoOrderRefunded"

/**
 * POST /api/admin/orders/:id/refund
 *
 * Same refund behavior as the seller endpoint, but restricted to marketplace admins.
 * Use when support refunds from the dashboard or needs to reconcile after a Stripe-side refund.
 * On full in-app refund, emits Klaviyo metric **Order Refunded** for the buyer.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  const { id: orderId } = await context.params
  const serviceSupabase = createServiceRoleClient()

  const { data: order, error: fetchErr } = await serviceSupabase
    .from("orders")
    .select(
      "id, seller_id, buyer_id, listing_id, amount, seller_earnings, status, payment_method, stripe_checkout_session_id",
    )
    .eq("id", orderId)
    .single()

  if (fetchErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const result = await issueMarketplaceOrderRefund(serviceSupabase, order)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  if (result.fullyRefundedInApp) {
    await emitKlaviyoOrderRefundedForOrder(serviceSupabase, orderId, {
      refundType: result.refund_type,
      source: "admin",
    })
  }

  return NextResponse.json({
    success: true,
    refund_type: result.refund_type,
    message: result.message,
    fullyRefundedInApp: result.fullyRefundedInApp,
    ...(result.alreadyProcessedInStripe != null
      ? { alreadyProcessedInStripe: result.alreadyProcessedInStripe }
      : {}),
  })
}
