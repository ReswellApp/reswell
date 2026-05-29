import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  buildOrderTrackingDetailFromShipEngineData,
  type OrderTrackingDetail,
} from "@/lib/shipping/order-tracking-detail"
import type { ShipEngineTrackWebhookPayload } from "@/lib/validations/shipengine-track-webhook"
import { persistOrderCarrierTrackingSnapshot } from "@/lib/services/persistOrderCarrierTracking"

function normalizeTrackingNumber(value: string): string {
  return value.trim()
}

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

  const trackingNumber = normalizeTrackingNumber(tnRaw)
  const detail = buildDetail(payload)
  if (!detail) {
    return { ok: false, error: "Could not build tracking detail" }
  }

  const supabase = createServiceRoleClient()
  const { data: rows, error } = await supabase
    .from("orders")
    .select("id")
    .eq("tracking_number", trackingNumber)

  if (error) {
    console.error("[applyShipEngineTrackWebhook] lookup", error)
    return { ok: false, error: "Database lookup failed" }
  }

  const orderIds = (rows ?? []).map((r) => (r as { id: string }).id)
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
