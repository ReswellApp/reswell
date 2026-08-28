import type { SupabaseClient } from "@supabase/supabase-js"
import {
  insertOrderShippingLabel,
  type OrderShippingLabelOrigin,
} from "@/lib/db/orderShippingLabels"
import { resolveOpenOrderShippingLabelFailures } from "@/lib/db/orderShippingLabelFailures"
import { updateOrderShipmentTracking } from "@/lib/db/orderShipments"
import { rollupOrderDeliveryFromShipments } from "@/lib/services/rollupOrderDeliveryFromShipments"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"

/**
 * Persists a marketplace shipping label for a shipment (or legacy order).
 * Writes tracking onto the shipment first, then rolls up denormalized order fields.
 * Does not mark the order shipped — the seller confirms drop-off separately.
 */
export async function attachOrderShippingLabel(params: {
  supabase: SupabaseClient
  orderId: string
  origin: OrderShippingLabelOrigin
  labelPdfUrl: string | null
  labelStoragePath: string | null
  trackingNumber: string | null
  trackingCarrier: string | null
  shipengineRateId?: string | null
  /** Preferred: shipment this label covers. */
  shipmentId?: string | null
  orderItemId?: string | null
  paperlessQrUrl?: string | null
  paperlessQrStoragePath?: string | null
  paperlessInstructions?: string | null
  paperlessHandoffCode?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const track = normalizeTrackingNumberForCarrier(params.trackingNumber ?? "") || null
  const car = params.trackingCarrier?.trim() || null
  const shipmentId = params.shipmentId?.trim() || null

  const ins = await insertOrderShippingLabel(params.supabase, {
    order_id: params.orderId,
    origin: params.origin,
    order_item_id: params.orderItemId ?? null,
    shipment_id: shipmentId,
    label_pdf_url: params.labelPdfUrl,
    label_storage_path: params.labelStoragePath,
    tracking_number: track,
    tracking_carrier: car,
    shipengine_rate_id: params.shipengineRateId ?? null,
    paperless_qr_url: params.paperlessQrUrl ?? null,
    paperless_qr_storage_path: params.paperlessQrStoragePath ?? null,
    paperless_instructions: params.paperlessInstructions ?? null,
    paperless_handoff_code: params.paperlessHandoffCode ?? null,
  })

  if (ins.error) {
    console.error("[attachOrderShippingLabel] insert:", ins.error.message)
    return { ok: false, error: ins.error.message || "Failed to save label record" }
  }

  if (track && shipmentId) {
    const shipUpd = await updateOrderShipmentTracking({
      supabase: params.supabase,
      shipmentId,
      trackingNumber: track,
      trackingCarrier: car,
      setIfEmpty: true,
    })
    if (!shipUpd.ok) {
      return { ok: false, error: `Label saved but shipment was not updated: ${shipUpd.error}` }
    }
    await rollupOrderDeliveryFromShipments(params.supabase, params.orderId)
  } else if (track) {
    // Legacy path before shipments exist for this order.
    const { data: orderRow } = await params.supabase
      .from("orders")
      .select("tracking_number")
      .eq("id", params.orderId)
      .maybeSingle()
    const existingTrack =
      typeof (orderRow as { tracking_number?: string | null } | null)?.tracking_number === "string"
        ? (orderRow as { tracking_number: string }).tracking_number.trim()
        : ""

    if (!existingTrack) {
      const { error: orderErr } = await params.supabase
        .from("orders")
        .update({
          tracking_number: track,
          tracking_carrier: car,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.orderId)

      if (orderErr) {
        console.error("[attachOrderShippingLabel] order update:", orderErr.message)
        return {
          ok: false,
          error: `Label saved but order was not updated: ${orderErr.message}`,
        }
      }
    } else {
      const { error: touchErr } = await params.supabase
        .from("orders")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", params.orderId)
      if (touchErr) {
        console.error("[attachOrderShippingLabel] order touch:", touchErr.message)
      }
    }
  }

  void resolveOpenOrderShippingLabelFailures(params.supabase, params.orderId, null)

  return { ok: true }
}
