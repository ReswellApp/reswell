import Stripe from "stripe"
import { getStripe } from "@/lib/stripe-server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getStoreStaffRole } from "@/lib/db/consignmentStores"
import { relistOrderListingsAfterRefund } from "@/lib/services/listingRelist"
import { syncMarketplaceOrderFromStripePaymentIntent } from "@/lib/services/stripeRefundWebhook"

export type RefundConsignmentResult =
  | { ok: true; pending: boolean; message: string }
  | { ok: false; error: string; status: number }

function isStripeChargeAlreadyRefundedError(err: unknown): boolean {
  if (err instanceof Stripe.errors.StripeInvalidRequestError && err.code === "charge_already_refunded") {
    return true
  }
  const msg = err instanceof Error ? err.message : String(err)
  return /already been refunded/i.test(msg)
}

type RefundOrderRow = {
  id: string
  status: string
  payment_method: string | null
  stripe_checkout_session_id: string | null
  consignment_store_id: string | null
}

/**
 * Staff-initiated refund of a consignment order (in-store POS or online). Issues the Stripe card
 * refund, then reverses the 3-way split atomically via `refund_consignment_order` and relists the
 * board. The store is resolved from the order itself (never trusted from the client) and the caller
 * must be staff of that store.
 */
export async function refundConsignmentOrder(input: {
  staffProfileId: string
  orderId: string
}): Promise<RefundConsignmentResult> {
  const { staffProfileId, orderId } = input

  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const { data, error } = await service
    .from("orders")
    .select("id, status, payment_method, stripe_checkout_session_id, consignment_store_id")
    .eq("id", orderId)
    .maybeSingle()

  if (error || !data) {
    return { ok: false, error: "Order not found.", status: 404 }
  }
  const order = data as RefundOrderRow

  if (!order.consignment_store_id) {
    return { ok: false, error: "This order is not a consignment order.", status: 400 }
  }

  const role = await getStoreStaffRole(service, order.consignment_store_id, staffProfileId)
  if (!role) {
    return { ok: false, error: "You don't have access to this store's orders.", status: 403 }
  }

  if (order.status === "refunded") {
    return { ok: false, error: "This order is already refunded.", status: 409 }
  }
  if (order.status !== "confirmed") {
    return { ok: false, error: "Only confirmed orders can be refunded.", status: 400 }
  }
  if (order.payment_method !== "stripe" || !order.stripe_checkout_session_id) {
    return { ok: false, error: "This order has no Stripe payment to refund.", status: 400 }
  }

  const stripe = getStripe()
  let refund: Stripe.Refund
  try {
    refund = await stripe.refunds.create({ payment_intent: order.stripe_checkout_session_id })
  } catch (err) {
    if (isStripeChargeAlreadyRefundedError(err)) {
      // Already refunded in Stripe — reconcile from Stripe state (consignment-aware).
      await syncMarketplaceOrderFromStripePaymentIntent(service, order.stripe_checkout_session_id)
      return {
        ok: true,
        pending: false,
        message: "This payment was already refunded in Stripe. The order has been reconciled.",
      }
    }
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[refundConsignmentOrder] stripe refund failed:", msg)
    return { ok: false, error: "Stripe refund failed.", status: 502 }
  }

  const nowIso = new Date().toISOString()

  if (refund.status !== "succeeded") {
    // Async card refund — mark refunding now; the Stripe webhook settles the split on success.
    await service
      .from("orders")
      .update({ status: "refunding", updated_at: nowIso })
      .eq("id", order.id)
      .eq("status", "confirmed")
    await service
      .from("payouts")
      .update({ status: "cancelled", updated_at: nowIso })
      .eq("order_id", order.id)

    return {
      ok: true,
      pending: true,
      message:
        "Refund started — Stripe is processing it. The board will relist and earnings reverse once the refund completes.",
    }
  }

  const { error: rpcErr } = await service.rpc("refund_consignment_order", { p_order_id: order.id })
  if (rpcErr) {
    console.error("[refundConsignmentOrder] refund_consignment_order rpc:", rpcErr)
    return { ok: false, error: "Refund issued in Stripe but reversing earnings failed.", status: 500 }
  }

  await relistOrderListingsAfterRefund(service, order.id)

  return { ok: true, pending: false, message: "Refund complete — the board is back on sale." }
}
