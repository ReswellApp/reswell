import type { SupabaseClient } from "@supabase/supabase-js"
import { updateOrderItemReturn } from "@/lib/db/orderItemReturns"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"

/**
 * Persists return label + tracking on an `order_item_returns` row.
 * Does not touch `orders.tracking_number` (outbound tracking stays intact).
 */
export async function attachOrderReturnShippingLabel(params: {
  supabase: SupabaseClient
  returnId: string
  labelPdfUrl: string | null
  labelStoragePath: string | null
  trackingNumber: string | null
  trackingCarrier: string | null
  shipengineLabelId?: string | null
  shipengineRateId?: string | null
  labelCostUsd?: number | null
  labelCostCurrency?: string | null
  paperlessQrUrl?: string | null
  paperlessQrStoragePath?: string | null
  paperlessInstructions?: string | null
  paperlessHandoffCode?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const track = normalizeTrackingNumberForCarrier(params.trackingNumber ?? "") || null
  const car = params.trackingCarrier?.trim() || null

  const upd = await updateOrderItemReturn(params.supabase, params.returnId, {
    label_pdf_url: params.labelPdfUrl,
    label_storage_path: params.labelStoragePath,
    tracking_number: track,
    tracking_carrier: car,
    shipengine_label_id: params.shipengineLabelId ?? null,
    shipengine_rate_id: params.shipengineRateId ?? null,
    label_cost_usd: params.labelCostUsd ?? null,
    label_cost_currency: params.labelCostCurrency ?? null,
    paperless_qr_url: params.paperlessQrUrl ?? null,
    paperless_qr_storage_path: params.paperlessQrStoragePath ?? null,
    paperless_instructions: params.paperlessInstructions ?? null,
    paperless_handoff_code: params.paperlessHandoffCode ?? null,
    status: "authorized",
  })

  if (upd.error) {
    console.error("[attachOrderReturnShippingLabel]", upd.error.message)
    return { ok: false, error: upd.error.message || "Failed to save return label" }
  }

  return { ok: true }
}
