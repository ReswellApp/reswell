import type { SupabaseClient } from "@supabase/supabase-js"
import { notifyBuyerOrderShippingUpdateKlaviyo } from "@/lib/services/notifyBuyerOrderShippingUpdateKlaviyo"
import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import {
  syncCarrierDeliveryFromTracking,
  type SyncCarrierDeliveryResult,
} from "@/lib/services/syncCarrierDeliveryFromTracking"
import { tryReleaseShippingPayoutAfterCarrierHold } from "@/lib/services/autoReleaseShippingPayoutsAfterCarrierDelivery"

export type PersistOrderCarrierTrackingResult = SyncCarrierDeliveryResult & {
  persisted: boolean
}

/**
 * Persists a ShipEngine tracking snapshot and syncs marketplace delivery from carrier scans.
 */
export async function persistOrderCarrierTrackingSnapshot(
  supabase: SupabaseClient,
  orderId: string,
  detail: OrderTrackingDetail,
): Promise<PersistOrderCarrierTrackingResult> {
  const empty: PersistOrderCarrierTrackingResult = {
    persisted: false,
    deliveredNewlyRecorded: false,
    deliveryStatusUpdated: false,
    carrierDeliveredAt: null,
    deliveryStatus: null,
  }

  const { data: existing, error: readErr } = await supabase
    .from("orders")
    .select("tracking_detail, delivery_status")
    .eq("id", orderId)
    .maybeSingle()

  if (readErr) {
    console.error("[persistOrderCarrierTrackingSnapshot] tracking_detail read:", readErr.message)
    return empty
  }

  const previousDetailRaw = (existing as { tracking_detail?: unknown } | null)?.tracking_detail
  const previousDeliveryStatus =
    typeof (existing as { delivery_status?: unknown } | null)?.delivery_status === "string"
      ? ((existing as { delivery_status: string }).delivery_status)
      : null

  const { error: updErr } = await supabase
    .from("orders")
    .update({
      tracking_detail: detail,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)

  if (updErr) {
    console.error("[persistOrderCarrierTrackingSnapshot] tracking_detail update:", updErr.message)
    return { ...empty, deliveryStatus: previousDeliveryStatus }
  }

  const sync = await syncCarrierDeliveryFromTracking(supabase, orderId, detail)
  await tryReleaseShippingPayoutAfterCarrierHold(orderId)
  await notifyBuyerOrderShippingUpdateKlaviyo(supabase, orderId, previousDetailRaw, detail)

  return {
    persisted: true,
    ...sync,
    deliveryStatus: sync.deliveryStatus ?? previousDeliveryStatus,
  }
}
