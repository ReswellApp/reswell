import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getOrderItemReturnById,
  updateOrderItemReturn,
} from "@/lib/db/orderItemReturns"
import {
  carrierTrackingIndicatesInTransit,
  resolveCarrierDeliveredAt,
} from "@/lib/shipping/carrier-delivery-payout-hold"
import { carrierTrackingIndicatesDelivered } from "@/lib/shipping/carrier-status-display"
import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import { tryRefundOrderItemReturnAfterCarrierHold } from "@/lib/services/autoRefundAfterReturnDelivered"

/**
 * Persists a ShipEngine tracking snapshot on a return row and advances return status.
 * Does not touch outbound order tracking or payout holds.
 */
export async function persistOrderReturnCarrierTrackingSnapshot(
  supabase: SupabaseClient,
  returnId: string,
  detail: OrderTrackingDetail,
): Promise<void> {
  const existing = await getOrderItemReturnById(supabase, returnId)
  if (!existing) {
    console.error("[persistOrderReturnCarrierTracking] return not found", returnId)
    return
  }

  if (existing.status === "cancelled" || existing.status === "refunded") {
    await updateOrderItemReturn(supabase, returnId, { tracking_detail: detail })
    return
  }

  const patch: Record<string, unknown> = {
    tracking_detail: detail,
  }

  if (carrierTrackingIndicatesDelivered(detail)) {
    const deliveredAtIso = resolveCarrierDeliveredAt(detail).toISOString()
    if (!existing.carrier_delivered_at) {
      patch.carrier_delivered_at = deliveredAtIso
    }
    if (existing.status === "authorized" || existing.status === "in_transit") {
      patch.status = "delivered"
    }
  } else if (
    carrierTrackingIndicatesInTransit(detail) &&
    (existing.status === "authorized" || existing.status === "in_transit")
  ) {
    patch.status = "in_transit"
  }

  const upd = await updateOrderItemReturn(supabase, returnId, patch)
  if (upd.error) {
    console.error("[persistOrderReturnCarrierTracking] update:", upd.error.message)
    return
  }

  await tryRefundOrderItemReturnAfterCarrierHold(returnId, new Date(), supabase)
}
