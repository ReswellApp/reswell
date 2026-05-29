import { createServiceRoleClient } from "@/lib/supabase/server"

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
    .select("id, order_num, is_admin_test")
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

  console.info(`[admin order delete] order=${orderId} admin=${audit.adminId}`)

  return { ok: true, orderNum: (order.order_num as string | null) ?? null }
}
