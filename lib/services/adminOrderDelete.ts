import { createServiceRoleClient } from "@/lib/supabase/server"
import { REAL_MARKETPLACE_SALES_FILTER } from "@/lib/order-admin-test"
import { relistAfterRefund } from "@/lib/services/listingRelist"

export type DeleteAdminTestOrderResult =
  | { ok: true; orderNum: string | null }
  | { ok: false; message: string; status: number }

function getServiceOrThrow(): ReturnType<typeof createServiceRoleClient> | null {
  try {
    return createServiceRoleClient()
  } catch {
    return null
  }
}

/**
 * Permanently delete an admin-seeded **test** order (`orders.is_admin_test = true`).
 *
 * Guard rails:
 * - Refuses to delete real marketplace orders — only `is_admin_test = true` rows are removable.
 * - Best-effort clears any payouts rows first (test orders shouldn't have them, but be safe);
 *   FK-cascading tables (shipping labels, support requests) clean themselves up on order delete.
 */
export async function deleteAdminTestOrderService(
  orderId: string,
  audit: { adminId: string },
): Promise<DeleteAdminTestOrderResult> {
  const supabase = getServiceOrThrow()
  if (!supabase) {
    return { ok: false, message: "Server misconfigured", status: 500 }
  }

  const { data: order, error: lookupErr } = await supabase
    .from("orders")
    .select("id, order_num, is_admin_test, listing_id")
    .eq("id", orderId)
    .maybeSingle()

  if (lookupErr) {
    console.error("[admin order delete] lookup", lookupErr)
    return { ok: false, message: "Could not load order", status: 500 }
  }
  if (!order) {
    return { ok: false, message: "Order not found", status: 404 }
  }
  if (order.is_admin_test !== true) {
    return {
      ok: false,
      message: "Only admin test orders can be deleted. This is a real marketplace order.",
      status: 403,
    }
  }

  // Defensive: remove any payouts referencing this order before deleting the row.
  const { error: payoutErr } = await supabase.from("payouts").delete().eq("order_id", orderId)
  if (payoutErr) {
    console.warn("[admin order delete] payouts cleanup (non-fatal):", payoutErr.message)
  }

  const { error: delErr } = await supabase
    .from("orders")
    .delete()
    .eq("id", orderId)
    .eq("is_admin_test", true)

  if (delErr) {
    console.error("[admin order delete] delete", delErr)
    return { ok: false, message: "Could not delete order", status: 500 }
  }

  const listingId = (order as { listing_id?: string | null }).listing_id
  if (listingId) {
    const { count: remainingConfirmedOrders, error: remainingErr } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listingId)
      .eq("status", "confirmed")
      .match(REAL_MARKETPLACE_SALES_FILTER)

    if (remainingErr) {
      console.error("[admin order delete] remaining orders lookup:", remainingErr.message)
    } else if ((remainingConfirmedOrders ?? 0) === 0) {
      await relistAfterRefund(supabase, listingId)
    }
  }

  console.info(`[admin order delete] order=${orderId} admin=${audit.adminId}`)

  return { ok: true, orderNum: (order.order_num as string | null) ?? null }
}
