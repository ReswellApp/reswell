import type { SupabaseClient } from "@supabase/supabase-js"
import { getOrderItemReturnById } from "@/lib/db/orderItemReturns"
import { fetchLiveShipEngineTracking } from "@/lib/shipengine/tracking"
import { isShipEngineConfigured } from "@/lib/shipengine/config"
import {
  buildOrderTrackingDetailFromShipEngineData,
  parseOrderTrackingDetail,
  type OrderTrackingDetail,
} from "@/lib/shipping/order-tracking-detail"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"
import { resolveShipEngineCarrierCode } from "@/lib/shipping/resolve-carrier-code"
import { persistOrderReturnCarrierTrackingSnapshot } from "@/lib/services/persistOrderReturnCarrierTracking"

export async function getOrderReturnCarrierTracking(params: {
  supabase: SupabaseClient
  returnId: string
  orderId: string
}): Promise<{
  data: OrderTrackingDetail | null
  live: boolean
  fetchError: string | null
  marketplace: {
    status: string
    tracking_number: string | null
    tracking_carrier: string | null
    carrier_delivered_at: string | null
  }
}> {
  const row = await getOrderItemReturnById(params.supabase, params.returnId)
  if (!row || row.order_id !== params.orderId) {
    return {
      data: null,
      live: false,
      fetchError: "Return not found",
      marketplace: {
        status: "missing",
        tracking_number: null,
        tracking_carrier: null,
        carrier_delivered_at: null,
      },
    }
  }

  const marketplace = {
    status: row.status,
    tracking_number: row.tracking_number,
    tracking_carrier: row.tracking_carrier,
    carrier_delivered_at: row.carrier_delivered_at,
  }

  const trackingNumber = normalizeTrackingNumberForCarrier(row.tracking_number ?? "")
  if (!trackingNumber) {
    return {
      data: parseOrderTrackingDetail(row.tracking_detail),
      live: false,
      fetchError: null,
      marketplace,
    }
  }

  if (!isShipEngineConfigured()) {
    return {
      data: parseOrderTrackingDetail(row.tracking_detail),
      live: false,
      fetchError: null,
      marketplace,
    }
  }

  const carrierCode =
    resolveShipEngineCarrierCode(trackingNumber, row.tracking_carrier) ??
    (row.tracking_carrier?.trim() || null)

  try {
    const live = await fetchLiveShipEngineTracking({ trackingNumber, carrierCode })
    if (!live.ok) {
      return {
        data: parseOrderTrackingDetail(row.tracking_detail),
        live: false,
        fetchError: live.error,
        marketplace,
      }
    }
    const detail = buildOrderTrackingDetailFromShipEngineData(live.payload)
    await persistOrderReturnCarrierTrackingSnapshot(params.supabase, params.returnId, detail)
    const refreshed = await getOrderItemReturnById(params.supabase, params.returnId)
    return {
      data: detail,
      live: true,
      fetchError: null,
      marketplace: refreshed
        ? {
            status: refreshed.status,
            tracking_number: refreshed.tracking_number,
            tracking_carrier: refreshed.tracking_carrier,
            carrier_delivered_at: refreshed.carrier_delivered_at,
          }
        : marketplace,
    }
  } catch (e) {
    return {
      data: parseOrderTrackingDetail(row.tracking_detail),
      live: false,
      fetchError: e instanceof Error ? e.message : "Tracking fetch failed",
      marketplace,
    }
  }
}
