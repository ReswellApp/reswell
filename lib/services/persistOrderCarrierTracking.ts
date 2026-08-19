import type { SupabaseClient } from "@supabase/supabase-js"
import { notifyBuyerOrderShippingUpdateKlaviyo } from "@/lib/services/notifyBuyerOrderShippingUpdateKlaviyo"
import { notifyOrderShippedKlaviyoIfMissing } from "@/lib/services/notifyOrderShippedKlaviyo"
import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import { syncCarrierDeliveryFromTracking } from "@/lib/services/syncCarrierDeliveryFromTracking"
import { tryReleaseShippingPayoutAfterCarrierHold } from "@/lib/services/autoReleaseShippingPayoutsAfterCarrierDelivery"

/**
 * Persists a ShipEngine tracking snapshot and syncs marketplace delivery from carrier scans.
 */
export async function persistOrderCarrierTrackingSnapshot(
  supabase: SupabaseClient,
  orderId: string,
  detail: OrderTrackingDetail,
): Promise<void> {
  const { data: existing, error: readErr } = await supabase
    .from("orders")
    .select("tracking_detail")
    .eq("id", orderId)
    .maybeSingle()

  if (readErr) {
    console.error("[persistOrderCarrierTrackingSnapshot] tracking_detail read:", readErr.message)
    return
  }

  const previousDetailRaw = (existing as { tracking_detail?: unknown } | null)?.tracking_detail

  const { error: updErr } = await supabase
    .from("orders")
    .update({
      tracking_detail: detail,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)

  if (updErr) {
    console.error("[persistOrderCarrierTrackingSnapshot] tracking_detail update:", updErr.message)
    return
  }

  await syncCarrierDeliveryFromTracking(supabase, orderId, detail)
  await tryReleaseShippingPayoutAfterCarrierHold(orderId)
  await notifyOrderShippedKlaviyoIfMissing(supabase, orderId)
  await notifyBuyerOrderShippingUpdateKlaviyo(supabase, orderId, previousDetailRaw, detail)
}
