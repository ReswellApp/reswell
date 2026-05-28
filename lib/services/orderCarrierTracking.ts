import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchLiveShipEngineTracking } from "@/lib/shipengine/tracking"
import { isShipEngineConfigured } from "@/lib/shipengine/config"
import {
  buildOrderTrackingDetailFromShipEngineData,
  parseOrderTrackingDetail,
  type OrderTrackingDetail,
} from "@/lib/shipping/order-tracking-detail"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"
import { resolveShipEngineCarrierCode } from "@/lib/shipping/resolve-carrier-code"

type OrderTrackingRow = {
  id: string
  tracking_number: string | null
  tracking_carrier: string | null
  tracking_detail: unknown
}

async function loadOrderForParticipant(
  supabase: SupabaseClient,
  orderId: string,
  userId: string,
): Promise<OrderTrackingRow | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, tracking_number, tracking_carrier, tracking_detail")
    .eq("id", orderId)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .maybeSingle()

  if (error || !data) return null
  return data as OrderTrackingRow
}

export type OrderCarrierTrackingResult =
  | {
      ok: true
      detail: OrderTrackingDetail
      live: boolean
      fetchError?: string
    }
  | { ok: false; error: string; status: number }

/**
 * Returns live carrier tracking for an order participant (buyer or seller).
 * Attempts ShipEngine API first, falls back to cached `tracking_detail`.
 */
export async function getOrderCarrierTrackingForParticipant(
  supabase: SupabaseClient,
  orderId: string,
  userId: string,
): Promise<OrderCarrierTrackingResult> {
  const order = await loadOrderForParticipant(supabase, orderId, userId)
  if (!order) {
    return { ok: false, error: "Order not found", status: 404 }
  }

  const trackingNumber = normalizeTrackingNumberForCarrier(order.tracking_number ?? "")
  if (!trackingNumber) {
    return { ok: false, error: "No tracking number on this order", status: 404 }
  }

  const cached = parseOrderTrackingDetail(order.tracking_detail)

  if (!isShipEngineConfigured()) {
    if (cached) {
      return { ok: true, detail: cached, live: false, fetchError: "Live tracking unavailable" }
    }
    return { ok: false, error: "Tracking is not available yet", status: 503 }
  }

  const carrierCode =
    resolveShipEngineCarrierCode(trackingNumber, order.tracking_carrier) ??
    (order.tracking_carrier?.trim() || null)

  let live: Awaited<ReturnType<typeof fetchLiveShipEngineTracking>>
  try {
    live = await fetchLiveShipEngineTracking({
      trackingNumber,
      carrierCode,
    })
  } catch (e) {
    console.error("[orderCarrierTracking] ShipEngine fetch", e)
    if (cached) {
      return {
        ok: true,
        detail: cached,
        live: false,
        fetchError: "Live tracking temporarily unavailable",
      }
    }
    return { ok: false, error: "Could not load carrier tracking", status: 502 }
  }

  if (live.ok) {
    const detail = buildOrderTrackingDetailFromShipEngineData(live.payload)
    return { ok: true, detail, live: true }
  }

  if (cached) {
    return {
      ok: true,
      detail: cached,
      live: false,
      fetchError: live.error,
    }
  }

  return {
    ok: false,
    error: live.error || "Could not load carrier tracking",
    status: live.status >= 400 ? live.status : 502,
  }
}
