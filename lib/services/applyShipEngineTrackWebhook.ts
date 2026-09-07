import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  buildOrderTrackingDetailFromShipEngineData,
  type OrderTrackingDetail,
} from "@/lib/shipping/order-tracking-detail"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"
import type { ShipEngineTrackWebhookPayload } from "@/lib/validations/shipengine-track-webhook"
import { findOrderIdsByTrackingNumber } from "@/lib/db/findOrdersByTrackingNumber"
import { findShipmentIdsByTrackingNumber } from "@/lib/db/orderShipments"
import { findReturnIdsByTrackingNumber } from "@/lib/db/findReturnsByTrackingNumber"
import {
  persistOrderCarrierTrackingSnapshot,
  persistShipmentCarrierTrackingSnapshot,
} from "@/lib/services/persistOrderCarrierTracking"
import { persistOrderReturnCarrierTrackingSnapshot } from "@/lib/services/persistOrderReturnCarrierTracking"

function buildDetail(payload: ShipEngineTrackWebhookPayload): OrderTrackingDetail | null {
  const data = payload.data
  if (!data) return null
  return buildOrderTrackingDetailFromShipEngineData(data)
}

/**
 * Persists latest carrier tracking on matching shipments (preferred), orders, or returns.
 * Outbound: syncs package + order delivery rollup + payout hold.
 * Returns: advances return status + refund hold.
 */
export async function applyShipEngineTrackWebhook(
  payload: ShipEngineTrackWebhookPayload,
): Promise<{ ok: true; matched: number } | { ok: false; error: string }> {
  const tnRaw = payload.data?.tracking_number
  if (typeof tnRaw !== "string" || !tnRaw.trim()) {
    return { ok: false, error: "Missing tracking_number in payload" }
  }

  const trackingNumber = normalizeTrackingNumberForCarrier(tnRaw)
  const detail = buildDetail(payload)
  if (!detail) {
    return { ok: false, error: "Could not build tracking detail" }
  }

  const supabase = createServiceRoleClient()
  const [shipmentLookup, orderLookup, returnLookup] = await Promise.all([
    findShipmentIdsByTrackingNumber(supabase, trackingNumber),
    findOrderIdsByTrackingNumber(supabase, trackingNumber),
    findReturnIdsByTrackingNumber(supabase, trackingNumber),
  ])

  if (shipmentLookup.error) {
    return { ok: false, error: shipmentLookup.error }
  }
  if (orderLookup.error) {
    return { ok: false, error: orderLookup.error }
  }
  if (returnLookup.error) {
    return { ok: false, error: returnLookup.error }
  }

  const shipmentIds = shipmentLookup.shipmentIds
  const returnIds = returnLookup.returnIds

  // Prefer shipment-scoped updates. Fall back to order-scoped for pre-migration rows.
  const orderIdsNeedingLegacy =
    shipmentIds.length > 0
      ? []
      : orderLookup.orderIds

  if (shipmentIds.length === 0 && orderIdsNeedingLegacy.length === 0 && returnIds.length === 0) {
    console.info("[applyShipEngineTrackWebhook] no shipment/order/return for tracking_number", {
      trackingNumber: trackingNumber.slice(0, 8) + "…",
    })
    return { ok: true, matched: 0 }
  }

  for (const shipmentId of shipmentIds) {
    const { data: ship } = await supabase
      .from("order_shipments")
      .select("order_id")
      .eq("id", shipmentId)
      .maybeSingle()
    const orderId = (ship as { order_id?: string } | null)?.order_id
    if (!orderId) continue
    await persistShipmentCarrierTrackingSnapshot(supabase, {
      orderId,
      shipmentId,
      detail,
    })
  }

  for (const orderId of orderIdsNeedingLegacy) {
    await persistOrderCarrierTrackingSnapshot(supabase, orderId, detail)
  }
  for (const returnId of returnIds) {
    await persistOrderReturnCarrierTrackingSnapshot(supabase, returnId, detail)
  }

  return {
    ok: true,
    matched: shipmentIds.length + orderIdsNeedingLegacy.length + returnIds.length,
  }
}
