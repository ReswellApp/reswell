import type { SupabaseClient } from "@supabase/supabase-js"
import { notifyBuyerOrderShippingUpdateKlaviyo } from "@/lib/services/notifyBuyerOrderShippingUpdateKlaviyo"
import { notifyOrderShippedKlaviyoIfMissing } from "@/lib/services/notifyOrderShippedKlaviyo"
import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import {
  carrierTrackingIndicatesScanned,
  resolveCarrierAcceptedAt,
} from "@/lib/shipping/carrier-status-display"
import {
  syncCarrierDeliveryFromTracking,
  syncShipmentCarrierDeliveryFromTracking,
} from "@/lib/services/syncCarrierDeliveryFromTracking"
import { tryReleaseShippingPayoutAfterCarrierHold } from "@/lib/services/autoReleaseShippingPayoutsAfterCarrierDelivery"
import { updateOrderShipmentCarrierFields } from "@/lib/db/orderShipments"
import { rollupOrderDeliveryFromShipments } from "@/lib/services/rollupOrderDeliveryFromShipments"

/**
 * Persists a ShipEngine tracking snapshot onto a shipment (preferred) or order,
 * then syncs marketplace delivery + payout hold from carrier scans.
 */
export async function persistShipmentCarrierTrackingSnapshot(
  supabase: SupabaseClient,
  params: {
    orderId: string
    shipmentId: string
    detail: OrderTrackingDetail
  },
): Promise<void> {
  const { orderId, shipmentId, detail } = params

  const { data: existing } = await supabase
    .from("order_shipments")
    .select("tracking_detail")
    .eq("id", shipmentId)
    .maybeSingle()

  const previousDetailRaw = (existing as { tracking_detail?: unknown } | null)?.tracking_detail

  const patch: Record<string, unknown> = {
    tracking_detail: detail,
  }

  if (carrierTrackingIndicatesScanned(detail)) {
    patch.carrier_accepted_at = resolveCarrierAcceptedAt(detail).toISOString()
  }

  const upd = await updateOrderShipmentCarrierFields({
    supabase,
    shipmentId,
    patch,
  })
  if (!upd.ok) {
    console.error("[persistShipmentCarrierTrackingSnapshot]", shipmentId, upd.error)
    return
  }

  // Mirror primary shipment detail onto the order for legacy readers.
  await supabase
    .from("orders")
    .update({
      tracking_detail: detail,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)

  await syncShipmentCarrierDeliveryFromTracking(supabase, shipmentId, detail)
  await rollupOrderDeliveryFromShipments(supabase, orderId)
  await tryReleaseShippingPayoutAfterCarrierHold(orderId)
  await notifyOrderShippedKlaviyoIfMissing(supabase, orderId)
  await notifyBuyerOrderShippingUpdateKlaviyo(supabase, orderId, previousDetailRaw, detail)
}

/**
 * Persists a ShipEngine tracking snapshot and syncs marketplace delivery from carrier scans.
 * Prefer {@link persistShipmentCarrierTrackingSnapshot} when shipment id is known.
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

  if (carrierTrackingIndicatesScanned(detail)) {
    const { error: acceptedErr } = await supabase
      .from("orders")
      .update({
        carrier_accepted_at: resolveCarrierAcceptedAt(detail).toISOString(),
      })
      .eq("id", orderId)
      .is("carrier_accepted_at", null)
    if (acceptedErr) {
      console.error(
        "[persistOrderCarrierTrackingSnapshot] carrier_accepted_at update:",
        acceptedErr.message,
      )
    }
  }

  await syncCarrierDeliveryFromTracking(supabase, orderId, detail)
  await tryReleaseShippingPayoutAfterCarrierHold(orderId)
  await notifyOrderShippedKlaviyoIfMissing(supabase, orderId)
  await notifyBuyerOrderShippingUpdateKlaviyo(supabase, orderId, previousDetailRaw, detail)
}
