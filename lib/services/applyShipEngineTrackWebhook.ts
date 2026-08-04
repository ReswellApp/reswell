import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  buildOrderTrackingDetailFromShipEngineData,
  type OrderTrackingDetail,
} from "@/lib/shipping/order-tracking-detail"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"
import type { ShipEngineTrackWebhookPayload } from "@/lib/validations/shipengine-track-webhook"
import { findOrderIdsByTrackingNumber } from "@/lib/db/findOrdersByTrackingNumber"
import { findReturnIdsByTrackingNumber } from "@/lib/db/findReturnsByTrackingNumber"
import { persistOrderCarrierTrackingSnapshot } from "@/lib/services/persistOrderCarrierTracking"
import { persistOrderReturnCarrierTrackingSnapshot } from "@/lib/services/persistOrderReturnCarrierTracking"

function buildDetail(payload: ShipEngineTrackWebhookPayload): OrderTrackingDetail | null {
  const data = payload.data
  if (!data) return null
  return buildOrderTrackingDetailFromShipEngineData(data)
}

/**
 * Persists latest carrier tracking on matching orders or return shipments (by tracking number).
 * Outbound: syncs marketplace delivery + payout hold. Returns: advances return status + refund hold.
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
  const [orderLookup, returnLookup] = await Promise.all([
    findOrderIdsByTrackingNumber(supabase, trackingNumber),
    findReturnIdsByTrackingNumber(supabase, trackingNumber),
  ])

  if (orderLookup.error) {
    return { ok: false, error: orderLookup.error }
  }
  if (returnLookup.error) {
    return { ok: false, error: returnLookup.error }
  }

  const orderIds = orderLookup.orderIds
  const returnIds = returnLookup.returnIds

  if (orderIds.length === 0 && returnIds.length === 0) {
    console.info("[applyShipEngineTrackWebhook] no order/return for tracking_number", {
      trackingNumber: trackingNumber.slice(0, 8) + "…",
    })
    return { ok: true, matched: 0 }
  }

  for (const orderId of orderIds) {
    await persistOrderCarrierTrackingSnapshot(supabase, orderId, detail)
  }
  for (const returnId of returnIds) {
    await persistOrderReturnCarrierTrackingSnapshot(supabase, returnId, detail)
  }

  return { ok: true, matched: orderIds.length + returnIds.length }
}
