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

export type PersistCarrierTrackingOptions = {
  /**
   * Email ordinary in-transit scans. Set for the ShipEngine webhook and the
   * carrier cron. Page and admin reads leave this off.
   */
  notifyScanUpdates?: boolean
}

function deliveryAlreadyRecorded(row: {
  delivery_status?: string | null
  carrier_delivered_at?: string | null
} | null): boolean {
  if ((row?.delivery_status ?? "").trim() === "delivered") return true
  return Boolean(row?.carrier_delivered_at?.trim())
}

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
    notifyScanUpdates?: boolean
  },
): Promise<void> {
  const { orderId, shipmentId, detail, notifyScanUpdates } = params

  const [{ data: existing }, orderDelivery] = await Promise.all([
    supabase.from("order_shipments").select("tracking_detail").eq("id", shipmentId).maybeSingle(),
    supabase
      .from("orders")
      .select("delivery_status, carrier_delivered_at")
      .eq("id", orderId)
      .maybeSingle(),
  ])

  const previousDetailRaw = (existing as { tracking_detail?: unknown } | null)?.tracking_detail
  const alreadyDelivered = deliveryAlreadyRecorded(
    orderDelivery.data as { delivery_status?: string | null; carrier_delivered_at?: string | null } | null,
  )

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
  await notifyBuyerOrderShippingUpdateKlaviyo(supabase, orderId, previousDetailRaw, detail, {
    notifyScanUpdates: notifyScanUpdates === true,
    deliveryAlreadyRecorded: alreadyDelivered,
  })
}

/**
 * Persists a ShipEngine tracking snapshot and syncs marketplace delivery from carrier scans.
 * Prefer {@link persistShipmentCarrierTrackingSnapshot} when shipment id is known.
 */
export async function persistOrderCarrierTrackingSnapshot(
  supabase: SupabaseClient,
  orderId: string,
  detail: OrderTrackingDetail,
  options?: PersistCarrierTrackingOptions,
): Promise<void> {
  const { data: existing, error: readErr } = await supabase
    .from("orders")
    .select("tracking_detail, delivery_status, carrier_delivered_at")
    .eq("id", orderId)
    .maybeSingle()

  if (readErr) {
    console.error("[persistOrderCarrierTrackingSnapshot] tracking_detail read:", readErr.message)
    return
  }

  const orderRow = existing as {
    tracking_detail?: unknown
    delivery_status?: string | null
    carrier_delivered_at?: string | null
  } | null
  const previousDetailRaw = orderRow?.tracking_detail
  const alreadyDelivered = deliveryAlreadyRecorded(orderRow)

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
  await notifyBuyerOrderShippingUpdateKlaviyo(supabase, orderId, previousDetailRaw, detail, {
    notifyScanUpdates: options?.notifyScanUpdates === true,
    deliveryAlreadyRecorded: alreadyDelivered,
  })
}
