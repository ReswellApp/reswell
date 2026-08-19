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

const LABEL_BUCKET = "order-shipping-labels"

export type LoadShippingLabelPdfBytesResult =
  | { ok: true; bytes: Uint8Array; contentType: string }
  | { ok: false; reason: "not_found" | "storage" | "fetch" }

/** Downloads the resolved label PDF bytes from storage or the carrier URL. */
export async function loadShippingLabelPdfBytes(
  supabase: SupabaseClient,
  input: { orderId: string; trackingNumber: string | null },
): Promise<LoadShippingLabelPdfBytesResult> {
  const label = await resolveOrderShippingLabelPdf(supabase, input)
  if (!label) return { ok: false, reason: "not_found" }

  if (label.shipEngineLabel) {
    await backfillMarketplaceLabelFromShipEngine({
      supabase,
      orderId: input.orderId,
      label: label.shipEngineLabel,
    })
  }

  if (label.label_storage_path?.trim()) {
    const { data: blob, error: dlErr } = await supabase.storage
      .from(LABEL_BUCKET)
      .download(label.label_storage_path.trim())

    if (dlErr || !blob) {
      console.error("[shipping-label pdf] storage:", dlErr)
      return { ok: false, reason: "storage" }
    }

    const buf = await blob.arrayBuffer()
    return { ok: true, bytes: new Uint8Array(buf), contentType: "application/pdf" }
  }

  const pdfUrl = label.label_pdf_url?.trim()
  if (!pdfUrl) return { ok: false, reason: "not_found" }

  let pdfRes: Response
  try {
    pdfRes = await fetch(pdfUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
      headers: { Accept: "application/pdf,*/*" },
    })
  } catch (e) {
    console.error("[shipping-label pdf] fetch pdf:", e)
    return { ok: false, reason: "fetch" }
  }

  if (!pdfRes.ok) return { ok: false, reason: "fetch" }

  const buf = await pdfRes.arrayBuffer()
  return {
    ok: true,
    bytes: new Uint8Array(buf),
    contentType: pdfRes.headers.get("content-type") ?? "application/pdf",
  }
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
