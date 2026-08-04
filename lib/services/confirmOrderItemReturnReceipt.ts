import type { SupabaseClient } from "@supabase/supabase-js"
import { getOrderItemReturnById, updateOrderItemReturn } from "@/lib/db/orderItemReturns"
import { tryRefundOrderItemReturnAfterCarrierHold } from "@/lib/services/autoRefundAfterReturnDelivered"

/**
 * Admin marks a return as received when carrier tracking is stuck.
 * Starts the same 24h refund clock as carrier delivery.
 */
export async function confirmOrderItemReturnReceipt(params: {
  supabase: SupabaseClient
  returnId: string
  orderId: string
}): Promise<{ ok: true; carrierDeliveredAt: string } | { ok: false; error: string; status: number }> {
  const row = await getOrderItemReturnById(params.supabase, params.returnId)
  if (!row || row.order_id !== params.orderId) {
    return { ok: false, error: "Return not found", status: 404 }
  }

  if (row.status === "cancelled") {
    return { ok: false, error: "Return is cancelled", status: 400 }
  }

  if (row.status === "refunded") {
    return { ok: false, error: "Return is already refunded", status: 409 }
  }

  const nowIso = new Date().toISOString()
  const deliveredAt = row.carrier_delivered_at ?? nowIso

  const upd = await updateOrderItemReturn(params.supabase, params.returnId, {
    carrier_delivered_at: deliveredAt,
    status: row.status === "refund_pending" ? "refund_pending" : "delivered",
  })

  if (upd.error) {
    return { ok: false, error: upd.error.message, status: 500 }
  }

  // If the 24h hold already elapsed (e.g. admin confirm after delayed ops), try refund now.
  await tryRefundOrderItemReturnAfterCarrierHold(params.returnId, new Date(), params.supabase)

  return { ok: true, carrierDeliveredAt: deliveredAt }
}
