import type { SupabaseClient } from "@supabase/supabase-js"
import {
  insertOrderShippingLabel,
  type OrderShippingLabelOrigin,
} from "@/lib/db/orderShippingLabels"
import { resolveOpenOrderShippingLabelFailures } from "@/lib/db/orderShippingLabelFailures"

/**
 * Persists a marketplace shipping label on the order (tracking only — not delivery_status shipped).
 * Used by post-checkout automation; does not post Messages (seller sees PDF on sale page).
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
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const track = params.trackingNumber?.trim() || null
  const car = params.trackingCarrier?.trim() || null

  const ins = await insertOrderShippingLabel(params.supabase, {
    order_id: params.orderId,
    origin: params.origin,
    label_pdf_url: params.labelPdfUrl,
    label_storage_path: params.labelStoragePath,
    tracking_number: track,
    tracking_carrier: car,
    shipengine_rate_id: params.shipengineRateId ?? null,
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
