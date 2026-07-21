import type { SupabaseClient } from "@supabase/supabase-js"
import {
  carrierTrackingIndicatesInTransit,
  resolveCarrierDeliveredAt,
  trackingDetailReportsDelivered,
} from "@/lib/shipping/carrier-delivery-payout-hold"
import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import { sendFulfillmentReviewReminder } from "@/lib/services/orderReviewInvite"

export type SyncCarrierDeliveryResult = {
  deliveredNewlyRecorded: boolean
  deliveryStatusUpdated: boolean
  carrierDeliveredAt: string | null
  /** Marketplace delivery_status after sync (or unchanged current value). */
  deliveryStatus: string | null
}

type OrderDeliveryRow = {
  id: string
  delivery_status: string
  carrier_delivered_at: string | null
}

/**
 * Applies ShipEngine tracking to marketplace delivery state.
 * Carrier "delivered" is the source of truth; in-transit scans mark the order shipped.
 */
export async function syncCarrierDeliveryFromTracking(
  supabase: SupabaseClient,
  orderId: string,
  detail: OrderTrackingDetail,
): Promise<SyncCarrierDeliveryResult> {
  const { data: row, error: fetchErr } = await supabase
    .from("orders")
    .select("id, delivery_status, carrier_delivered_at")
    .eq("id", orderId)
    .maybeSingle()

  if (fetchErr || !row) {
    return {
      deliveredNewlyRecorded: false,
      deliveryStatusUpdated: false,
      carrierDeliveredAt: null,
      deliveryStatus: null,
    }
  }

  const order = row as OrderDeliveryRow
  const nowIso = new Date().toISOString()
  let deliveredNewlyRecorded = false
  let deliveryStatusUpdated = false

  if (trackingDetailReportsDelivered(detail)) {
    const deliveredAtIso = resolveCarrierDeliveredAt(detail).toISOString()
    const patch: Record<string, unknown> = { updated_at: nowIso }

    if (!order.carrier_delivered_at) {
      patch.carrier_delivered_at = deliveredAtIso
      deliveredNewlyRecorded = true
    }

    if (order.delivery_status !== "delivered") {
      patch.delivery_status = "delivered"
      deliveryStatusUpdated = true
    }

    if (Object.keys(patch).length > 1) {
      await supabase.from("orders").update(patch).eq("id", orderId)
    }

    if (deliveryStatusUpdated) {
      void sendFulfillmentReviewReminder(orderId)
    }

    await supabase
      .from("payouts")
      .update({
        hold_reason: "awaiting_carrier_settlement",
        updated_at: nowIso,
      })
      .eq("order_id", orderId)
      .eq("status", "held")

    return {
      deliveredNewlyRecorded,
      deliveryStatusUpdated,
      carrierDeliveredAt: (order.carrier_delivered_at ?? deliveredAtIso) as string,
      deliveryStatus: deliveryStatusUpdated ? "delivered" : order.delivery_status,
    }
  }

  if (
    carrierTrackingIndicatesInTransit(detail) &&
    order.delivery_status === "pending"
  ) {
    await supabase
      .from("orders")
      .update({ delivery_status: "shipped", updated_at: nowIso })
      .eq("id", orderId)
      .eq("delivery_status", "pending")

    await supabase
      .from("payouts")
      .update({
        hold_reason: "awaiting_delivery",
        updated_at: nowIso,
      })
      .eq("order_id", orderId)
      .eq("status", "held")

    deliveryStatusUpdated = true
  }

  return {
    deliveredNewlyRecorded: false,
    deliveryStatusUpdated,
    carrierDeliveredAt: order.carrier_delivered_at,
    deliveryStatus: deliveryStatusUpdated ? "shipped" : order.delivery_status,
  }
}
