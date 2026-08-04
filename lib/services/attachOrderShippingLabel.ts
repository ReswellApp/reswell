import type { SupabaseClient } from "@supabase/supabase-js"
import {
  insertOrderShippingLabel,
  type OrderShippingLabelOrigin,
} from "@/lib/db/orderShippingLabels"
import { resolveOpenOrderShippingLabelFailures } from "@/lib/db/orderShippingLabelFailures"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"

/**
 * Persists a marketplace shipping label on the order and writes tracking to the order row.
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
  paperlessQrUrl?: string | null
  paperlessQrStoragePath?: string | null
  paperlessInstructions?: string | null
  paperlessHandoffCode?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const track = normalizeTrackingNumberForCarrier(params.trackingNumber ?? "") || null
  const car = params.trackingCarrier?.trim() || null

  const ins = await insertOrderShippingLabel(params.supabase, {
    order_id: params.orderId,
    origin: params.origin,
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

  const orderPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (track) {
    orderPatch.tracking_number = track
    orderPatch.tracking_carrier = car
  }

  const { error: orderErr } = await params.supabase
    .from("orders")
    .update(orderPatch)
    .eq("id", params.orderId)

  if (orderErr) {
    console.error("[attachOrderShippingLabel] order update:", orderErr.message)
    return {
      ok: false,
      error: `Label saved but order was not updated: ${orderErr.message}`,
    }
  }

  void resolveOpenOrderShippingLabelFailures(params.supabase, params.orderId, null)

  return { ok: true }
}
