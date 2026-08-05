import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { issueMarketplaceOrderRefund } from "@/lib/services/issueMarketplaceOrderRefund"
import { emitKlaviyoOrderRefundedForOrder } from "@/lib/services/klaviyoOrderRefunded"
import {
  MARKETPLACE_ORDER_REFUND_DISPOSITIONS,
} from "@/lib/services/marketplaceOrderRefundDisposition"

const bodySchema = z
  .object({
    disposition: z.enum(MARKETPLACE_ORDER_REFUND_DISPOSITIONS).optional(),
  })
  .strict()

/**
 * POST /api/admin/orders/:id/refund
 *
 * Full-order marketplace refund for admins. Body may include `disposition` to choose
 * post-refund listing + messaging behavior (see marketplaceOrderRefundDisposition).
 * On full in-app refund, emits Klaviyo metric **Order Refunded** for the buyer.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  const { id: orderId } = await context.params

  let disposition: (typeof MARKETPLACE_ORDER_REFUND_DISPOSITIONS)[number] | null = null
  const contentType = request.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    // Empty body is fine (legacy clients).
    if (raw != null && typeof raw === "object" && Object.keys(raw as object).length > 0) {
      const parsed = bodySchema.safeParse(raw)
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid refund disposition", details: parsed.error.flatten() },
          { status: 400 },
        )
      }
      if (parsed.data.disposition) {
        disposition = parsed.data.disposition
      }
    }
  }

  const serviceSupabase = createServiceRoleClient()

  const { data: order, error: fetchErr } = await serviceSupabase
    .from("orders")
    .select(
      "id, seller_id, buyer_id, listing_id, amount, seller_earnings, status, payment_method, stripe_checkout_session_id, refund_disposition",
    )
    .eq("id", orderId)
    .single()

  if (fetchErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const result = await issueMarketplaceOrderRefund(serviceSupabase, order, {
    // Sync-only path ignores disposition; for confirmed orders use the chosen plan.
    disposition: order.status === "refunding" ? undefined : (disposition ?? undefined),
  })

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
    disposition: result.disposition,
    message: result.message,
    fullyRefundedInApp: result.fullyRefundedInApp,
    labelVoid: result.labelVoid,
    ...(result.alreadyProcessedInStripe != null
      ? { alreadyProcessedInStripe: result.alreadyProcessedInStripe }
      : {}),
  })
}
