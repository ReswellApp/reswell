import type { SupabaseClient } from "@supabase/supabase-js"
import { getLatestPreparedShippingLabelForOrder } from "@/lib/db/orderShippingLabels"
import { attachOrderShippingLabel } from "@/lib/services/attachOrderShippingLabel"
import {
  fetchLabelById,
  fetchLabelsByTrackingNumber,
  type ShipEngineLabelDetail,
} from "@/lib/shipengine/label-lookup"
import { isShipEngineConfigured } from "@/lib/shipengine/config"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"

export type ResolvedOrderShippingLabelPdf = {
  label_pdf_url: string | null
  label_storage_path: string | null
  /** Set when the PDF came from a live ShipEngine lookup (not yet stored for this order). */
  shipEngineLabel?: ShipEngineLabelDetail
}

function normalizeTracking(value: string): string {
  return normalizeTrackingNumberForCarrier(value)
}

function pickLabelPdfUrl(label: ShipEngineLabelDetail): string | null {
  return label.downloads.pdf?.trim() || label.downloads.href?.trim() || null
}

async function resolveShipEngineLabelPdfByTracking(
  trackingNumber: string,
): Promise<{ pdf: Omit<ResolvedOrderShippingLabelPdf, "shipEngineLabel">; label: ShipEngineLabelDetail } | null> {
  if (!isShipEngineConfigured()) return null

  const track = normalizeTracking(trackingNumber)
  if (!track) return null

  const listed = await fetchLabelsByTrackingNumber(track)
  if (!listed.ok || listed.labels.length === 0) return null

  const normalized = normalizeTracking(track)
  const candidate =
    listed.labels.find(
      (label) =>
        !label.voided &&
        label.tracking_number &&
        normalizeTracking(label.tracking_number) === normalized,
    ) ?? listed.labels.find((label) => !label.voided)

  if (!candidate?.label_id) return null

  const detail = await fetchLabelById(candidate.label_id)
  if (!detail.ok || detail.label.voided) return null

  const pdfUrl = pickLabelPdfUrl(detail.label)
  if (!pdfUrl) return null

  return {
    pdf: { label_pdf_url: pdfUrl, label_storage_path: null },
    label: detail.label,
  }
}

/** Stored marketplace/admin PDF first; Reswell-purchased labels may be resolved from ShipEngine by tracking. */
export async function resolveOrderShippingLabelPdf(
  supabase: SupabaseClient,
  input: { orderId: string; trackingNumber: string | null },
): Promise<ResolvedOrderShippingLabelPdf | null> {
  const stored = await getLatestPreparedShippingLabelForOrder(supabase, input.orderId)
  if (stored) return stored

  const track = input.trackingNumber?.trim()
  if (!track) return null

  const fromShipEngine = await resolveShipEngineLabelPdfByTracking(track)
  if (!fromShipEngine) return null

  return {
    ...fromShipEngine.pdf,
    shipEngineLabel: fromShipEngine.label,
  }
}

export async function orderHasAccessibleShippingLabelPdf(
  supabase: SupabaseClient,
  input: { orderId: string; trackingNumber: string | null },
): Promise<boolean> {
  const resolved = await resolveOrderShippingLabelPdf(supabase, input)
  return Boolean(resolved?.label_pdf_url || resolved?.label_storage_path)
}

/** Persist a ShipEngine label on the order when automation missed writing the PDF row. */
export async function backfillMarketplaceLabelFromShipEngine(params: {
  supabase: SupabaseClient
  orderId: string
  label: ShipEngineLabelDetail
}): Promise<void> {
  const existing = await getLatestPreparedShippingLabelForOrder(params.supabase, params.orderId)
  if (existing) return

  const pdfUrl = pickLabelPdfUrl(params.label)
  if (!pdfUrl) return

  const attached = await attachOrderShippingLabel({
    supabase: params.supabase,
    orderId: params.orderId,
    origin: "auto_reswell_checkout",
    labelPdfUrl: pdfUrl,
    labelStoragePath: null,
    trackingNumber: params.label.tracking_number,
    trackingCarrier: params.label.carrier_code,
    shipengineRateId: null,
  })

  if (!attached.ok) {
    console.warn(
      `[backfillMarketplaceLabelFromShipEngine] failed for ${params.orderId}:`,
      attached.error,
    )
  }
}
