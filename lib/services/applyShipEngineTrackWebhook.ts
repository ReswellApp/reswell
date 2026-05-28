import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  buildOrderTrackingDetailFromShipEngineData,
  type OrderTrackingDetail,
} from "@/lib/shipping/order-tracking-detail"
import type { ShipEngineTrackWebhookPayload } from "@/lib/validations/shipengine-track-webhook"

function normalizeTrackingNumber(value: string): string {
  return value.trim()
}

function buildDetail(payload: ShipEngineTrackWebhookPayload): OrderTrackingDetail | null {
  const data = payload.data
  if (!data) return null
  return buildOrderTrackingDetailFromShipEngineData(data)
}

/**
 * Persists latest carrier tracking snapshot on matching orders (by tracking number).
 * Does not settle payouts — admins release seller earnings manually after verifying delivery.
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
    .update({
      tracking_detail: detail,
      updated_at: new Date().toISOString(),
    })
    .eq("tracking_number", trackingNumber)
    .select("id")

  if (error) {
    console.error("[applyShipEngineTrackWebhook] update", error)
    return { ok: false, error: "Database update failed" }
  }

  const n = rows?.length ?? 0
  if (n === 0) {
    console.info("[applyShipEngineTrackWebhook] no order for tracking_number", {
      trackingNumber: trackingNumber.slice(0, 8) + "…",
    })
  }

  return { ok: true, matched: n }
}
