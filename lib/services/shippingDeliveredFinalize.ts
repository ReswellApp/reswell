import { releaseOrderSellerEarningsAfterFulfillment } from "@/lib/services/releaseOrderSellerEarnings"
import { createServiceRoleClient } from "@/lib/supabase/server"

export type ShippingDeliveredFinalizeResult =
  | { ok: true; transitionedToDelivered: boolean; walletReleasedNew: boolean }
  | { ok: false; error: string }

/**
 * Shipped orders only: ensures `delivery_status` is `delivered`, payout moves held → pending,
 * and seller wallet credit runs (idempotent RPC).
 * Invoked from admin “Approve payout” after delivery is verified (buyer confirmation is informational only).
 */
export async function markShippingDeliveredAndReleaseSellerEarnings(
  orderId: string,
): Promise<ShippingDeliveredFinalizeResult> {
  let svc
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("[shippingDeliveredFinalize] service role:", e)
    return { ok: false, error: "Server configuration error" }
  }

  const { data: row, error: fetchErr } = await svc
    .from("orders")
    .select("id, status, fulfillment_method, delivery_status")
    .eq("id", orderId)
    .maybeSingle()

  if (fetchErr || !row) {
    return { ok: false, error: "Order not found" }
  }

  const order = row as {
    id: string
    status: string
    fulfillment_method: string | null
    delivery_status: string
  }

  if (order.status !== "confirmed") {
    return { ok: false, error: "Order not active" }
  }
  if (order.fulfillment_method !== "shipping") {
    return { ok: false, error: "Not a shipped order" }
  }

  if (order.delivery_status !== "shipped" && order.delivery_status !== "delivered") {
    return {
      ok: false,
      error:
        order.delivery_status === "pending"
          ? "Order must be shipped before delivery can finalize"
          : "Invalid fulfillment state",
    }
  }

  const nowIso = new Date().toISOString()
  let transitionedToDelivered = false

  if (order.delivery_status === "shipped") {
    const { data: patched, error: updErr } = await svc
      .from("orders")
      .update({ delivery_status: "delivered", updated_at: nowIso })
      .eq("id", orderId)
      .eq("delivery_status", "shipped")
      .select("id")
      .maybeSingle()

    if (updErr) {
      console.error("[shippingDeliveredFinalize] order update:", updErr)
      return { ok: false, error: "Failed to update delivery status" }
    }

    if (patched?.id) {
      transitionedToDelivered = true
    } else {
      const { data: current } = await svc
        .from("orders")
        .select("delivery_status")
        .eq("id", orderId)
        .maybeSingle()
      const ds = (current as { delivery_status?: string } | null)?.delivery_status
      if (ds !== "delivered") {
        return { ok: false, error: "Could not finalize delivery status" }
      }
    }
  }

  const { error: payErr } = await svc
    .from("payouts")
    .update({
      status: "pending",
      hold_reason: null,
      released_at: nowIso,
      updated_at: nowIso,
    })
    .eq("order_id", orderId)
    .eq("status", "held")

  if (payErr) {
    console.error("[shippingDeliveredFinalize] payouts update:", payErr)
    return { ok: false, error: "Could not release payout record" }
  }

  const { data: payoutRow, error: payoutReadErr } = await svc
    .from("payouts")
    .select("status, released_at")
    .eq("order_id", orderId)
    .maybeSingle()

  if (payoutReadErr || !payoutRow) {
    console.error("[shippingDeliveredFinalize] payouts read:", payoutReadErr)
    return { ok: false, error: "Could not verify payout record" }
  }

  const pr = payoutRow as { status: string; released_at: string | null }
  if (pr.status !== "pending" || pr.released_at == null || String(pr.released_at).trim() === "") {
    return {
      ok: false,
      error:
        "Payout is still on hold or was not moved to a releasable state. Refresh the page or apply DB migrations.",
    }
  }

  const release = await releaseOrderSellerEarningsAfterFulfillment(orderId)
  if (!release.ok) {
    return { ok: false, error: release.error }
  }

  return { ok: true, transitionedToDelivered, walletReleasedNew: release.released }
}
