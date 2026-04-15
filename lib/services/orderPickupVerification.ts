import { createServiceRoleClient } from "@/lib/supabase/server"
import { releaseOrderSellerEarningsAfterFulfillment } from "@/lib/services/releaseOrderSellerEarnings"

function normalizePickupCode(value: string | number | null | undefined): string {
  return String(value ?? "").trim()
}

export type VerifyPickupResult =
  | {
      ok: true
      buyerId: string
      listingId: string
    }
  | { ok: false; error: string; status: number }

/**
 * Seller verifies the buyer's pickup code. Uses the service role for writes because:
 * - `payouts` is SELECT-only for `authenticated` (RLS has no seller UPDATE policy).
 * - Some deployments predate `orders_update_as_seller`; user-scoped order UPDATE can fail RLS.
 * Authorization: `sellerUserId` must come from the session; all writes are scoped by `seller_id`.
 */
export async function verifyOrderPickupForSeller(input: {
  orderId: string
  sellerUserId: string
  code: string
}): Promise<VerifyPickupResult> {
  const { orderId, sellerUserId, code } = input
  const trimmedCode = code.trim()

  let admin
  try {
    admin = createServiceRoleClient()
  } catch (e) {
    console.error("[verifyOrderPickupForSeller] service client", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }

  const { data: order, error: fetchErr } = await admin
    .from("orders")
    .select("id, seller_id, buyer_id, fulfillment_method, delivery_status, pickup_code, listing_id")
    .eq("id", orderId)
    .eq("seller_id", sellerUserId)
    .maybeSingle()

  if (fetchErr || !order) {
    return { ok: false, error: "Order not found", status: 404 }
  }

  if (order.fulfillment_method !== "pickup") {
    return { ok: false, error: "This order is not a pickup order", status: 400 }
  }

  if (order.delivery_status === "picked_up") {
    return { ok: false, error: "Pickup already confirmed", status: 409 }
  }

  if (normalizePickupCode(order.pickup_code) !== trimmedCode) {
    return { ok: false, error: "Invalid pickup code", status: 403 }
  }

  const now = new Date().toISOString()

  const { error: orderUpdateErr } = await admin
    .from("orders")
    .update({ delivery_status: "picked_up", updated_at: now })
    .eq("id", orderId)
    .eq("seller_id", sellerUserId)

  if (orderUpdateErr) {
    console.error("[verifyOrderPickupForSeller] orders update", orderUpdateErr)
    return { ok: false, error: "Failed to update order", status: 500 }
  }

  const { error: payoutUpdateErr } = await admin
    .from("payouts")
    .update({
      status: "pending",
      hold_reason: null,
      released_at: now,
      updated_at: now,
    })
    .eq("order_id", orderId)
    .eq("seller_id", sellerUserId)
    .eq("status", "held")

  if (payoutUpdateErr) {
    console.error("[verifyOrderPickupForSeller] payouts update", payoutUpdateErr)
    return { ok: false, error: "Failed to update payout record", status: 500 }
  }

  const release = await releaseOrderSellerEarningsAfterFulfillment(orderId)
  if (!release.ok) {
    console.error("[verifyOrderPickupForSeller] release seller earnings:", release.error)
    return { ok: false, error: release.error, status: 500 }
  }

  return { ok: true, buyerId: order.buyer_id, listingId: order.listing_id }
}
