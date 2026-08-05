import type { SupabaseClient } from "@supabase/supabase-js"
import { insertOrderSupportRequest } from "@/lib/db/order-support"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { REAL_MARKETPLACE_SALES_FILTER } from "@/lib/order-admin-test"
import { SHIPPING_DEADLINE_DAYS, AUTO_CANCEL_UNSHIPPED_ORDERS_ENABLED } from "@/lib/shipping-deadline"
import {
  issueMarketplaceOrderRefund,
  type MarketplaceOrderRefundRow,
} from "@/lib/services/issueMarketplaceOrderRefund"

type AutoCancelCandidate = MarketplaceOrderRefundRow & {
  order_num: string | null
  buyer_id: string
  created_at: string
  tracking_number: string | null
}

export type AutoCancelUnshippedOrdersSummary = {
  scanned: number
  cancelled: number
  failed: number
  errors: Array<{ orderId: string; error: string }>
}

export async function autoCancelUnshippedOrders(
  supabase: SupabaseClient,
  referenceTime: Date = new Date(),
): Promise<AutoCancelUnshippedOrdersSummary> {
  if (!AUTO_CANCEL_UNSHIPPED_ORDERS_ENABLED) {
    return { scanned: 0, cancelled: 0, failed: 0, errors: [] }
  }

  const cutoff = new Date(referenceTime.getTime())
  cutoff.setUTCDate(cutoff.getUTCDate() - SHIPPING_DEADLINE_DAYS)
  const cutoffIso = cutoff.toISOString()

  const { data: candidates, error } = await supabase
    .from("orders")
    .select(
      "id, seller_id, buyer_id, listing_id, amount, seller_earnings, status, payment_method, stripe_checkout_session_id, order_num, created_at, tracking_number",
    )
    .eq("status", "confirmed")
    .eq("fulfillment_method", "shipping")
    .eq("delivery_status", "pending")
    .is("tracking_number", null)
    .match(REAL_MARKETPLACE_SALES_FILTER)
    .lt("created_at", cutoffIso)

  if (error) {
    throw new Error(error.message)
  }

  const summary: AutoCancelUnshippedOrdersSummary = {
    scanned: candidates?.length ?? 0,
    cancelled: 0,
    failed: 0,
    errors: [],
  }

  for (const row of candidates ?? []) {
    const order = row as AutoCancelCandidate
    const result = await autoCancelSingleUnshippedOrder(supabase, order)
    if (result.ok) {
      summary.cancelled++
    } else {
      summary.failed++
      summary.errors.push({ orderId: order.id, error: result.error })
    }
  }

  return summary
}

async function autoCancelSingleUnshippedOrder(
  supabase: SupabaseClient,
  order: AutoCancelCandidate,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Label void is handled by `cancel_unshipped` disposition inside issueMarketplaceOrderRefund.
  const refundResult = await issueMarketplaceOrderRefund(supabase, order, {
    disposition: "cancel_unshipped",
  })
  if (!refundResult.ok) {
    return { ok: false, error: refundResult.error }
  }

  const orderRef = formatOrderNumForCustomer(order.order_num, order.id)
  const { error: supportErr } = await insertOrderSupportRequest(supabase, {
    order_id: order.id,
    buyer_id: order.buyer_id,
    request_type: "help",
    body: `[Automatic cancellation] Seller did not ship within ${SHIPPING_DEADLINE_DAYS} days. Full refund initiated by Reswell.`,
    contacted_seller_first: null,
    order_ref: orderRef,
  })

  if (supportErr) {
    console.error("[auto-cancel-unshipped] support audit insert", supportErr)
  }

  return { ok: true }
}
