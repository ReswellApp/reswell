import { createServiceRoleClient } from "@/lib/supabase/server"
import { releaseOrderSellerEarningsAfterFulfillment } from "@/lib/services/releaseOrderSellerEarnings"

export type VerifyPickupResult =
  | {
      ok: true
      buyerId: string
      listingId: string
    }
  | { ok: false; error: string; status: number }

/**
 * Seller verifies the buyer's pickup code. Uses the service role client for DB
 * operations (bypasses RLS) while the caller is authenticated via the route.
 * Mirrors the direct-query pattern used by confirm-delivery for shipping orders.
 */
export async function verifyOrderPickupForSeller(input: {
  sellerId: string
  orderId: string
  code: string
}): Promise<VerifyPickupResult> {
  const { sellerId, orderId, code } = input
  const trimmedCode = code.trim()

  if (!trimmedCode) {
    return { ok: false, error: "Pickup code is required", status: 400 }
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    console.error("[verifyOrderPickupForSeller] service client", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }

  const { data: order, error: fetchErr } = await supabase
    .from("orders")
    .select("id, seller_id, buyer_id, listing_id, fulfillment_method, delivery_status, pickup_code")
    .eq("id", orderId)
    .eq("seller_id", sellerId)
    .maybeSingle()

  if (fetchErr) {
    console.error("[verifyOrderPickupForSeller] fetch order", fetchErr)
    return { ok: false, error: "Failed to verify pickup", status: 500 }
  }

  if (!order) {
    return { ok: false, error: "Order not found", status: 404 }
  }

  if (order.fulfillment_method !== "pickup") {
    return { ok: false, error: "This order is not a pickup order", status: 400 }
  }

  if (order.delivery_status === "picked_up") {
    return { ok: false, error: "Pickup already confirmed", status: 409 }
  }

  const storedCode = (order.pickup_code ?? "").trim()
  if (storedCode !== trimmedCode) {
    return { ok: false, error: "Invalid pickup code", status: 403 }
  }

  const now = new Date().toISOString()

  const { error: updateErr } = await supabase
    .from("orders")
    .update({ delivery_status: "picked_up", updated_at: now })
    .eq("id", orderId)

  if (updateErr) {
    console.error("[verifyOrderPickupForSeller] update order", updateErr)
    return { ok: false, error: "Failed to update order", status: 500 }
  }

  await supabase
    .from("payouts")
    .update({ status: "pending", hold_reason: null, released_at: now, updated_at: now })
    .eq("order_id", orderId)
    .eq("seller_id", sellerId)
    .eq("status", "held")

  const release = await releaseOrderSellerEarningsAfterFulfillment(orderId)
  if (!release.ok) {
    console.error("[verifyOrderPickupForSeller] release seller earnings:", release.error)
    return { ok: false, error: release.error, status: 500 }
  }

  return { ok: true, buyerId: order.buyer_id, listingId: order.listing_id }
}
