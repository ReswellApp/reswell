import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import { sessionToShippingAddressRecord } from "@/lib/stripe-shipping-address"

export const CART_CHECKOUT_MODE = "cart"

/**
 * Mark shop order paid and decrement inventory after a successful Stripe Checkout session.
 */
export async function completeCartCheckoutFromSession(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<{ ok: true; duplicate?: boolean } | { ok: false; error: string }> {
  if (session.metadata?.mode !== CART_CHECKOUT_MODE) {
    return { ok: false, error: "Invalid session mode" }
  }

  if (session.payment_status !== "paid") {
    return { ok: false, error: "Payment not completed" }
  }

  const orderId = session.metadata.order_id
  const userId = session.metadata.user_id
  if (!orderId || !userId) {
    return { ok: false, error: "Missing order metadata" }
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, user_id, status, total")
    .eq("id", orderId)
    .single()

  if (orderError || !order) {
    return { ok: false, error: "Order not found" }
  }

  if (order.user_id !== userId) {
    return { ok: false, error: "Order mismatch" }
  }

  const expectedCents = Math.round(Number(order.total) * 100)
  if (typeof session.amount_total !== "number" || session.amount_total !== expectedCents) {
    return { ok: false, error: "Amount mismatch" }
  }

  if (order.status === "paid") {
    return { ok: true, duplicate: true }
  }

  if (order.status !== "pending") {
    return { ok: false, error: "Order is not payable" }
  }

  const shippingPayload = sessionToShippingAddressRecord(session)
  if (!shippingPayload) {
    return {
      ok: false,
      error:
        "Missing shipping address from checkout. If you were charged, contact support with your receipt.",
    }
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status: "paid",
      stripe_session_id: session.id,
      shipping_address: shippingPayload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("status", "pending")

  if (updateError) {
    return { ok: false, error: "Failed to update order" }
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("listing_id, quantity")
    .eq("order_id", orderId)

  for (const item of items ?? []) {
    const { data: inv } = await supabase
      .from("inventory")
      .select("quantity")
      .eq("listing_id", item.listing_id)
      .single()

    if (inv) {
      const nextQty = Math.max(0, Number(inv.quantity) - Number(item.quantity))
      await supabase
        .from("inventory")
        .update({ quantity: nextQty, updated_at: new Date().toISOString() })
        .eq("listing_id", item.listing_id)
    }
  }

  return { ok: true }
}
