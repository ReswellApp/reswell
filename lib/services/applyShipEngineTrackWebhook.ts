import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  buildOrderTrackingDetailFromShipEngineData,
  type OrderTrackingDetail,
} from "@/lib/shipping/order-tracking-detail"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"
import type { ShipEngineTrackWebhookPayload } from "@/lib/validations/shipengine-track-webhook"
import { findOrderIdsByTrackingNumber } from "@/lib/db/findOrdersByTrackingNumber"
import { persistOrderCarrierTrackingSnapshot } from "@/lib/services/persistOrderCarrierTracking"

function buildDetail(payload: ShipEngineTrackWebhookPayload): OrderTrackingDetail | null {
  const data = payload.data
  if (!data) return null
  return buildOrderTrackingDetailFromShipEngineData(data)
}

/**
 * Persists latest carrier tracking on matching orders (by tracking number),
 * syncs marketplace delivery from ShipEngine, and auto-releases payouts after the 24h hold.
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
  const lookup = await findOrderIdsByTrackingNumber(supabase, trackingNumber)
  if (lookup.error) {
    return { ok: false, error: lookup.error }
  }

  const orderIds = lookup.orderIds
  if (orderIds.length === 0) {
    console.info("[applyShipEngineTrackWebhook] no order for tracking_number", {
      trackingNumber: trackingNumber.slice(0, 8) + "…",
    })
    return { ok: true, matched: 0 }
  }

  for (const orderId of orderIds) {
    await persistOrderCarrierTrackingSnapshot(supabase, orderId, detail)
  }

  return { ok: true, matched: orderIds.length }
}
