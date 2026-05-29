import type { SupabaseClient } from "@supabase/supabase-js"
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
}
