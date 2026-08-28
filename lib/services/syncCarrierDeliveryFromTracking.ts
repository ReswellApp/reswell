import type { SupabaseClient } from "@supabase/supabase-js"
import {
  carrierTrackingIndicatesInTransit,
  resolveCarrierDeliveredAt,
  trackingDetailReportsDelivered,
} from "@/lib/shipping/carrier-delivery-payout-hold"
import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import { sendFulfillmentReviewReminder } from "@/lib/services/orderReviewInvite"
import {
  getOrderShipmentById,
  updateOrderShipmentCarrierFields,
} from "@/lib/db/orderShipments"
import {
  computeOrderDeliveryRollup,
  rollupOrderDeliveryFromShipments,
} from "@/lib/services/rollupOrderDeliveryFromShipments"
import { listOrderShipments } from "@/lib/db/orderShipments"

export type SyncCarrierDeliveryResult = {
  deliveredNewlyRecorded: boolean
  deliveryStatusUpdated: boolean
  carrierDeliveredAt: string | null
}

/**
 * Applies ShipEngine tracking to a single shipment, then rolls up the parent order.
 * Order-level carrier_delivered_at / payout clock only advance when ALL shipments are delivered.
 */
export async function syncShipmentCarrierDeliveryFromTracking(
  supabase: SupabaseClient,
  shipmentId: string,
  detail: OrderTrackingDetail,
): Promise<SyncCarrierDeliveryResult> {
  const shipment = await getOrderShipmentById(supabase, shipmentId)
  if (!shipment) {
    return {
      deliveredNewlyRecorded: false,
      deliveryStatusUpdated: false,
      carrierDeliveredAt: null,
    }
  }

  const orderId = shipment.order_id
  const nowIso = new Date().toISOString()
  let deliveredNewlyRecorded = false
  let shipmentStatusUpdated = false

  if (trackingDetailReportsDelivered(detail)) {
    const deliveredAtIso = resolveCarrierDeliveredAt(detail).toISOString()
    const patch: Record<string, unknown> = {
      tracking_detail: detail,
    }

    if (!shipment.carrier_delivered_at) {
      patch.carrier_delivered_at = deliveredAtIso
      deliveredNewlyRecorded = true
    }
    if (shipment.delivery_status !== "delivered") {
      patch.delivery_status = "delivered"
      shipmentStatusUpdated = true
    }

    const upd = await updateOrderShipmentCarrierFields({
      supabase,
      shipmentId,
      patch,
    })
    if (!upd.ok) {
      return {
        deliveredNewlyRecorded: false,
        deliveryStatusUpdated: false,
        carrierDeliveredAt: shipment.carrier_delivered_at,
      }
    }
  } else if (
    carrierTrackingIndicatesInTransit(detail) &&
    shipment.delivery_status === "pending"
  ) {
    const upd = await updateOrderShipmentCarrierFields({
      supabase,
      shipmentId,
      patch: {
        delivery_status: "shipped",
        tracking_detail: detail,
      },
    })
    if (!upd.ok) {
      return {
        deliveredNewlyRecorded: false,
        deliveryStatusUpdated: false,
        carrierDeliveredAt: shipment.carrier_delivered_at,
      }
    }
    shipmentStatusUpdated = true
  } else {
    await updateOrderShipmentCarrierFields({
      supabase,
      shipmentId,
      patch: { tracking_detail: detail },
    })
  }

  const before = await listOrderShipments(supabase, orderId)
  const beforeRollup = computeOrderDeliveryRollup(before)
  const rollup = await rollupOrderDeliveryFromShipments(supabase, orderId)

  const orderDeliveryUpdated =
    beforeRollup.deliveryStatus !== rollup.deliveryStatus ||
    (!!rollup.carrierDeliveredAt && !beforeRollup.carrierDeliveredAt)

  if (rollup.deliveryStatus === "delivered" && orderDeliveryUpdated) {
    void sendFulfillmentReviewReminder(orderId)
  }

  // Payout hold: only when the whole order is carrier-delivered (all packages).
  if (rollup.allShipmentsDelivered && rollup.carrierDeliveredAt) {
    const { error: payoutUpdErr } = await supabase
      .from("payouts")
      .update({
        hold_reason: "awaiting_carrier_settlement",
        updated_at: nowIso,
      })
      .eq("order_id", orderId)
      .eq("status", "held")

    if (payoutUpdErr) {
      console.error(
        "[syncShipmentCarrierDeliveryFromTracking] payout hold update:",
        orderId,
        payoutUpdErr.message,
      )
    }
  } else if (rollup.anyShipmentShipped && rollup.deliveryStatus === "shipped") {
    const { error: payoutUpdErr } = await supabase
      .from("payouts")
      .update({
        hold_reason: "awaiting_delivery",
        updated_at: nowIso,
      })
      .eq("order_id", orderId)
      .eq("status", "held")
      .neq("hold_reason", "awaiting_carrier_settlement")

    if (payoutUpdErr) {
      console.error(
        "[syncShipmentCarrierDeliveryFromTracking] payout awaiting_delivery:",
        orderId,
        payoutUpdErr.message,
      )
    }
  }

  return {
    deliveredNewlyRecorded: deliveredNewlyRecorded && rollup.allShipmentsDelivered,
    deliveryStatusUpdated: shipmentStatusUpdated || orderDeliveryUpdated,
    carrierDeliveredAt: rollup.carrierDeliveredAt,
  }
}

/**
 * Legacy order-scoped sync. Prefer {@link syncShipmentCarrierDeliveryFromTracking}.
 * Kept for callers that only have an order id (single-package / rollup path).
 */
export async function syncCarrierDeliveryFromTracking(
  supabase: SupabaseClient,
  orderId: string,
  detail: OrderTrackingDetail,
): Promise<SyncCarrierDeliveryResult> {
  const shipments = await listOrderShipments(supabase, orderId)
  if (shipments.length === 0) {
    // Pre-shipments orders: keep historical order-row behavior.
    return syncLegacyOrderCarrierDelivery(supabase, orderId, detail)
  }

  // Apply to the matching shipment when we know which package this scan belongs to.
  // Callers that know the tracking number should prefer syncShipmentCarrierDeliveryFromTracking.
  const match = shipments[0]!
  return syncShipmentCarrierDeliveryFromTracking(supabase, match.id, detail)
}

async function syncLegacyOrderCarrierDelivery(
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
    if (fetchErr) {
      console.error("[syncCarrierDeliveryFromTracking] fetch:", orderId, fetchErr.message)
    }
    return {
      deliveredNewlyRecorded: false,
      deliveryStatusUpdated: false,
      carrierDeliveredAt: null,
    }
  }

  const order = row as {
    id: string
    delivery_status: string
    carrier_delivered_at: string | null
  }
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
      const { error: orderUpdErr } = await supabase.from("orders").update(patch).eq("id", orderId)

      if (orderUpdErr) {
        console.error(
          "[syncCarrierDeliveryFromTracking] order delivered update:",
          orderId,
          orderUpdErr.message,
        )
        return {
          deliveredNewlyRecorded: false,
          deliveryStatusUpdated: false,
          carrierDeliveredAt: order.carrier_delivered_at,
        }
      }
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
    }
  }

  if (carrierTrackingIndicatesInTransit(detail) && order.delivery_status === "pending") {
    const { error: shipUpdErr } = await supabase
      .from("orders")
      .update({ delivery_status: "shipped", updated_at: nowIso })
      .eq("id", orderId)
      .eq("delivery_status", "pending")

    if (shipUpdErr) {
      console.error(
        "[syncCarrierDeliveryFromTracking] order shipped update:",
        orderId,
        shipUpdErr.message,
      )
      return {
        deliveredNewlyRecorded: false,
        deliveryStatusUpdated: false,
        carrierDeliveredAt: order.carrier_delivered_at,
      }
    }

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
  }
}
