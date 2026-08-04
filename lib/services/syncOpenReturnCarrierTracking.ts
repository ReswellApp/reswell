import { createServiceRoleClient } from "@/lib/supabase/server"
import { fetchLiveShipEngineTracking } from "@/lib/shipengine/tracking"
import { isShipEngineConfigured } from "@/lib/shipengine/config"
import {
  buildOrderTrackingDetailFromShipEngineData,
  parseOrderTrackingDetail,
} from "@/lib/shipping/order-tracking-detail"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"
import { resolveShipEngineCarrierCode } from "@/lib/shipping/resolve-carrier-code"
import { persistOrderReturnCarrierTrackingSnapshot } from "@/lib/services/persistOrderReturnCarrierTracking"
import { trackingDetailReportsDelivered } from "@/lib/shipping/carrier-delivery-payout-hold"

const BATCH_LIMIT = 40

export type SyncOpenReturnCarrierTrackingSummary = {
  scanned: number
  synced: number
  deliveredNewlyRecorded: number
  skipped: number
  errors: string[]
}

type OpenReturnRow = {
  id: string
  tracking_number: string | null
  tracking_carrier: string | null
  tracking_detail: unknown
  carrier_delivered_at: string | null
}

/**
 * Polls ShipEngine for open return shipments missing carrier_delivered_at.
 */
export async function syncOpenReturnCarrierTracking(): Promise<SyncOpenReturnCarrierTrackingSummary> {
  const summary: SyncOpenReturnCarrierTrackingSummary = {
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

  const { data: rows, error } = await supabase
    .from("order_item_returns")
    .select("id, tracking_number, tracking_carrier, tracking_detail, carrier_delivered_at")
    .in("status", ["authorized", "in_transit", "delivered", "refund_pending"])
    .not("tracking_number", "is", null)
    .is("carrier_delivered_at", null)
    .order("updated_at", { ascending: true })
    .limit(BATCH_LIMIT)

  if (error) {
    summary.errors.push(error.message)
    return summary
  }

  const list = (rows ?? []) as OpenReturnRow[]
  summary.scanned = list.length

  for (const row of list) {
    const trackingNumber = normalizeTrackingNumberForCarrier(row.tracking_number ?? "")
    if (!trackingNumber) {
      summary.skipped += 1
      continue
    }

    const cached = parseOrderTrackingDetail(row.tracking_detail)
    if (cached && trackingDetailReportsDelivered(cached)) {
      try {
        await persistOrderReturnCarrierTrackingSnapshot(supabase, row.id, cached)
        summary.synced += 1
        summary.deliveredNewlyRecorded += 1
        continue
      } catch (e) {
        summary.errors.push(
          `${row.id}: ${e instanceof Error ? e.message : "persist cached delivered failed"}`,
        )
      }
    }

    const carrierCode =
      resolveShipEngineCarrierCode(trackingNumber, row.tracking_carrier) ??
      (row.tracking_carrier?.trim() || null)

    let live: Awaited<ReturnType<typeof fetchLiveShipEngineTracking>>
    try {
      live = await fetchLiveShipEngineTracking({
        trackingNumber,
        carrierCode,
      })
    } catch (e) {
      summary.errors.push(
        `${row.id}: ${e instanceof Error ? e.message : "ShipEngine fetch failed"}`,
      )
      continue
    }

    if (!live.ok) {
      summary.skipped += 1
      continue
    }

    const detail = buildOrderTrackingDetailFromShipEngineData(live.payload)
    try {
      const beforeDelivered = Boolean(row.carrier_delivered_at)
      await persistOrderReturnCarrierTrackingSnapshot(supabase, row.id, detail)
      summary.synced += 1
      if (!beforeDelivered && trackingDetailReportsDelivered(detail)) {
        summary.deliveredNewlyRecorded += 1
      }
    } catch (e) {
      summary.errors.push(
        `${row.id}: ${e instanceof Error ? e.message : "persist live tracking failed"}`,
      )
    }
  }

  return summary
}
