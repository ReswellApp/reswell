import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  buildOrderTrackingDetailFromShipEngineData,
  type OrderTrackingDetail,
} from "@/lib/shipping/order-tracking-detail"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"
import type { ShipEngineTrackWebhookPayload } from "@/lib/validations/shipengine-track-webhook"
import { persistOrderCarrierTrackingSnapshot } from "@/lib/services/persistOrderCarrierTracking"

function buildDetail(payload: ShipEngineTrackWebhookPayload): OrderTrackingDetail | null {
  const data = payload.data
  if (!data) return null
  return buildOrderTrackingDetailFromShipEngineData(data)
}

async function findOrderIdsByTrackingNumber(
  supabase: ReturnType<typeof createServiceRoleClient>,
  trackingNumber: string,
): Promise<string[]> {
  const normalized = normalizeTrackingNumberForCarrier(trackingNumber)
  if (!normalized) return []

  const trimmed = trackingNumber.trim()
  const exactValues = trimmed === normalized ? [normalized] : [trimmed, normalized]

  const { data: exactRows, error: exactErr } = await supabase
    .from("orders")
    .select("id, tracking_number")
    .in("tracking_number", exactValues)

  if (exactErr) {
    console.error("[applyShipEngineTrackWebhook] exact lookup", exactErr)
    throw new Error("Database lookup failed")
  }

  const matched = new Map<string, string>()
  for (const row of exactRows ?? []) {
    const id = (row as { id: string }).id
    matched.set(id, id)
  }
  if (matched.size > 0) {
    return [...matched.keys()]
  }

  // Fallback: stored tracking may include spaces/formatting ShipEngine strips.
  const { data: openRows, error: openErr } = await supabase
    .from("orders")
    .select("id, tracking_number")
    .not("tracking_number", "is", null)
    .in("delivery_status", ["pending", "shipped"])
    .order("updated_at", { ascending: false })
    .limit(500)

  if (openErr) {
    console.error("[applyShipEngineTrackWebhook] open-order lookup", openErr)
    throw new Error("Database lookup failed")
  }

  for (const row of openRows ?? []) {
    const id = (row as { id: string }).id
    const stored = (row as { tracking_number: string | null }).tracking_number
    if (normalizeTrackingNumberForCarrier(stored ?? "") === normalized) {
      matched.set(id, id)
    }
  }

  return [...matched.keys()]
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

  const trackingNumber = tnRaw.trim()
  const detail = buildDetail(payload)
  if (!detail) {
    return { ok: false, error: "Could not build tracking detail" }
  }

  const supabase = createServiceRoleClient()

  let orderIds: string[]
  try {
    orderIds = await findOrderIdsByTrackingNumber(supabase, trackingNumber)
  } catch {
    return { ok: false, error: "Database lookup failed" }
  }

  if (orderIds.length === 0) {
    console.info("[applyShipEngineTrackWebhook] no order for tracking_number", {
      trackingNumber: normalizeTrackingNumberForCarrier(trackingNumber).slice(0, 8) + "…",
    })
    return { ok: true, matched: 0 }
  }

  for (const orderId of orderIds) {
    await persistOrderCarrierTrackingSnapshot(supabase, orderId, detail)
  }

  return { ok: true, matched: orderIds.length }
}
