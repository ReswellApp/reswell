import { createServiceRoleClient } from "@/lib/supabase/server"
import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import type { ShipEngineTrackWebhookPayload } from "@/lib/validations/shipengine-track-webhook"

const MAX_EVENTS = 25

function normalizeTrackingNumber(value: string): string {
  return value.trim()
}

function buildDetail(payload: ShipEngineTrackWebhookPayload): OrderTrackingDetail | null {
  const data = payload.data
  if (!data) return null

  const rawEvents = Array.isArray(data.events) ? data.events : []
  const sorted = [...rawEvents].sort((a, b) => {
    const ta = a.occurred_at ? Date.parse(a.occurred_at) : 0
    const tb = b.occurred_at ? Date.parse(b.occurred_at) : 0
    return tb - ta
  })
  const events = sorted.slice(0, MAX_EVENTS).map((e) => ({
    occurred_at: e.occurred_at,
    description: e.description ?? null,
    city_locality: e.city_locality ?? null,
    state_province: e.state_province ?? null,
  }))

  return {
    source: "shipengine",
    status_code: data.status_code ?? null,
    status_description: data.status_description ?? null,
    carrier_status_description: data.carrier_status_description ?? null,
    estimated_delivery_date: data.estimated_delivery_date ?? null,
    actual_delivery_date: data.actual_delivery_date ?? null,
    exception_description: data.exception_description ?? null,
    events,
    updated_at: new Date().toISOString(),
  }
}

/**
 * Persists latest carrier tracking snapshot on matching orders (by tracking number).
 * Does not change delivery_status — buyer confirm-delivery remains authoritative for payouts.
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
