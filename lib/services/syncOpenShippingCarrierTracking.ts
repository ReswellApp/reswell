import { createServiceRoleClient } from "@/lib/supabase/server"
import { fetchLiveShipEngineTracking } from "@/lib/shipengine/tracking"
import { isShipEngineConfigured } from "@/lib/shipengine/config"
import {
  buildOrderTrackingDetailFromShipEngineData,
  parseOrderTrackingDetail,
} from "@/lib/shipping/order-tracking-detail"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"
import { resolveShipEngineCarrierCode } from "@/lib/shipping/resolve-carrier-code"
import { persistOrderCarrierTrackingSnapshot } from "@/lib/services/persistOrderCarrierTracking"
import { trackingDetailReportsDelivered } from "@/lib/shipping/carrier-delivery-payout-hold"

const BATCH_LIMIT = 40

export type SyncOpenCarrierTrackingSummary = {
  scanned: number
  synced: number
  deliveredNewlyRecorded: number
  skipped: number
  errors: string[]
}

type OpenTrackedOrder = {
  id: string
  tracking_number: string | null
  tracking_carrier: string | null
  tracking_detail: unknown
  carrier_delivered_at: string | null
}

/**
 * Polls ShipEngine for confirmed shipping orders that still lack carrier_delivered_at.
 * Backfills delivery status when webhooks were missed and starts the 24h payout clock.
 */
export async function syncOpenShippingCarrierTracking(): Promise<SyncOpenCarrierTrackingSummary> {
  const summary: SyncOpenCarrierTrackingSummary = {
    scanned: 0,
    synced: 0,
    deliveredNewlyRecorded: 0,
    skipped: 0,
    errors: [],
  }

  if (!isShipEngineConfigured()) {
    summary.errors.push("ShipEngine is not configured")
    return summary
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    summary.errors.push(e instanceof Error ? e.message : "Missing service role client")
    return summary
  }

  // Prefer orders whose cached tracking already says delivered but marketplace clock never started.
  const { data: staleDeliveredRows, error: staleErr } = await supabase
    .from("orders")
    .select("id, tracking_number, tracking_carrier, tracking_detail, carrier_delivered_at")
    .eq("fulfillment_method", "shipping")
    .eq("status", "confirmed")
    .not("tracking_number", "is", null)
    .is("carrier_delivered_at", null)
    .in("delivery_status", ["pending", "shipped", "delivered"])
    .order("updated_at", { ascending: true })
    .limit(BATCH_LIMIT)

  if (staleErr) {
    summary.errors.push(staleErr.message)
    return summary
  }

  const rows = (staleDeliveredRows ?? []) as OpenTrackedOrder[]
  summary.scanned = rows.length

  for (const order of rows) {
    const trackingNumber = normalizeTrackingNumberForCarrier(order.tracking_number ?? "")
    if (!trackingNumber) {
      summary.skipped += 1
      continue
    }

    // If cached detail already reports delivered, re-persist to set carrier_delivered_at.
    const cached = parseOrderTrackingDetail(order.tracking_detail)
    if (cached && trackingDetailReportsDelivered(cached)) {
      try {
        await persistOrderCarrierTrackingSnapshot(supabase, order.id, cached)
        summary.synced += 1
        if (!order.carrier_delivered_at) {
          summary.deliveredNewlyRecorded += 1
        }
        continue
      } catch (e) {
        summary.errors.push(
          `${order.id}: ${e instanceof Error ? e.message : "persist cached delivered failed"}`,
        )
      }
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
      summary.errors.push(
        `${order.id}: ${e instanceof Error ? e.message : "ShipEngine fetch failed"}`,
      )
      continue
    }

    if (!live.ok) {
      summary.skipped += 1
      continue
    }

    const detail = buildOrderTrackingDetailFromShipEngineData(live.payload)
    try {
      await persistOrderCarrierTrackingSnapshot(supabase, order.id, detail)
      summary.synced += 1
      if (trackingDetailReportsDelivered(detail) && !order.carrier_delivered_at) {
        summary.deliveredNewlyRecorded += 1
      }
    } catch (e) {
      summary.errors.push(
        `${order.id}: ${e instanceof Error ? e.message : "persist live tracking failed"}`,
      )
    }
  }

  return summary
}
