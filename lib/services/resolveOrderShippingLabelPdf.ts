import type { SupabaseClient } from "@supabase/supabase-js"
import { getLatestPreparedShippingLabelForOrder } from "@/lib/db/orderShippingLabels"
import { attachOrderShippingLabel } from "@/lib/services/attachOrderShippingLabel"
import { storeLabelPdfBytes } from "@/lib/services/storeOrderShippingLabelAssets"
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

export function preparedUrlsIncludePdf(
  label: { label_pdf_url?: string | null; label_storage_path?: string | null } | null,
): boolean {
  return Boolean(label?.label_pdf_url?.trim() || label?.label_storage_path?.trim())
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
  input: { orderId: string; trackingNumber: string | null; labelId?: string | null },
): Promise<ResolvedOrderShippingLabelPdf | null> {
  if (input.labelId?.trim()) {
    const { data } = await supabase
      .from("order_shipping_labels")
      .select(
        "label_pdf_url, label_storage_path, paperless_qr_url, paperless_qr_storage_path, paperless_instructions, paperless_handoff_code",
      )
      .eq("order_id", input.orderId)
      .eq("id", input.labelId.trim())
      .maybeSingle()
    if (data) {
      const row = data as {
        label_pdf_url: string | null
        label_storage_path: string | null
      }
      if (row.label_pdf_url?.trim() || row.label_storage_path?.trim()) {
        return {
          label_pdf_url: row.label_pdf_url?.trim() || null,
          label_storage_path: row.label_storage_path?.trim() || null,
        }
      }
    }
  }

  const stored = await getLatestPreparedShippingLabelForOrder(supabase, input.orderId)
  // A paperless-only row is not a printable PDF. Keep looking at the purchase
  // lock and ShipEngine so a paid label is still visible to admin.
  if (preparedUrlsIncludePdf(stored)) return stored

  const fromLock = await resolvePurchasedLockPdf(supabase, input.orderId)
  if (fromLock) return fromLock

  const track = input.trackingNumber?.trim()
  if (!track) return null

  const fromShipEngine = await resolveShipEngineLabelPdfByTracking(track)
  if (!fromShipEngine) return null

  return {
    ...fromShipEngine.pdf,
    shipEngineLabel: fromShipEngine.label,
  }
}

/** PDF URL saved on the purchase lock when the order label row never stored one. */
async function resolvePurchasedLockPdf(
  supabase: SupabaseClient,
  orderId: string,
): Promise<ResolvedOrderShippingLabelPdf | null> {
  const { data, error } = await supabase
    .from("shipengine_label_purchase_locks")
    .select("label_pdf_url, status")
    .eq("order_id", orderId)
    .eq("status", "purchased")

  if (error || !data?.length) return null

  for (const raw of data) {
    const url =
      raw && typeof raw === "object" && "label_pdf_url" in raw && typeof raw.label_pdf_url === "string"
        ? raw.label_pdf_url.trim()
        : ""
    if (url) return { label_pdf_url: url, label_storage_path: null }
  }
  return null
}

export async function orderHasAccessibleShippingLabelPdf(
  supabase: SupabaseClient,
  input: { orderId: string; trackingNumber: string | null; labelId?: string | null },
): Promise<boolean> {
  const resolved = await resolveOrderShippingLabelPdf(supabase, input)
  return preparedUrlsIncludePdf(resolved)
}

const LABEL_BUCKET = "order-shipping-labels"

export type LoadShippingLabelPdfBytesResult =
  | { ok: true; bytes: Uint8Array; contentType: string }
  | { ok: false; reason: "not_found" | "storage" | "fetch" }

/** Downloads the resolved label PDF bytes from storage or the carrier URL. */
export async function loadShippingLabelPdfBytes(
  supabase: SupabaseClient,
  input: { orderId: string; trackingNumber: string | null; labelId?: string | null },
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

    if (!dlErr && blob) {
      const buf = await blob.arrayBuffer()
      return { ok: true, bytes: new Uint8Array(buf), contentType: "application/pdf" }
    }
    console.error("[shipping-label pdf] storage:", dlErr)
  }

  const pdfUrl = label.label_pdf_url?.trim()
  if (pdfUrl) {
    const remote = await fetchRemotePdf(pdfUrl)
    if (remote.ok) {
      await cacheLabelPdfBytes(supabase, input.orderId, remote.bytes, Boolean(label.label_storage_path?.trim()))
      return remote
    }
  }

  const track = input.trackingNumber?.trim()
  if (track && !label.shipEngineLabel) {
    const fromShipEngine = await resolveShipEngineLabelPdfByTracking(track)
    const freshUrl = fromShipEngine?.pdf.label_pdf_url?.trim()
    if (freshUrl) {
      const remote = await fetchRemotePdf(freshUrl)
      if (remote.ok) {
        await backfillMarketplaceLabelFromShipEngine({
          supabase,
          orderId: input.orderId,
          label: fromShipEngine.label,
        })
        await cacheLabelPdfBytes(supabase, input.orderId, remote.bytes, true)
        return remote
      }
    }
  }

  if (pdfUrl || label.label_storage_path?.trim()) return { ok: false, reason: "fetch" }
  return { ok: false, reason: "not_found" }
}

async function fetchRemotePdf(
  pdfUrl: string,
): Promise<{ ok: true; bytes: Uint8Array; contentType: string } | { ok: false }> {
  let pdfRes: Response
  try {
    pdfRes = await fetch(pdfUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
      headers: { Accept: "application/pdf,*/*" },
    })
  } catch (e) {
    console.error("[shipping-label pdf] fetch pdf:", e)
    return { ok: false }
  }
  if (!pdfRes.ok) return { ok: false }
  const buf = await pdfRes.arrayBuffer()
  return {
    ok: true,
    bytes: new Uint8Array(buf),
    contentType: pdfRes.headers.get("content-type") ?? "application/pdf",
  }
}

/** Copies a downloaded PDF into storage and points the newest label row at it. */
async function cacheLabelPdfBytes(
  supabase: SupabaseClient,
  orderId: string,
  bytes: Uint8Array,
  replaceExistingPath: boolean,
): Promise<void> {
  const stored = await storeLabelPdfBytes({ supabase, orderId, bytes })
  if (!stored.ok) return
  await rememberLabelStoragePath(supabase, orderId, stored.storagePath, replaceExistingPath)
}

async function rememberLabelStoragePath(
  supabase: SupabaseClient,
  orderId: string,
  storagePath: string,
  replaceExistingPath: boolean,
): Promise<void> {
  const [marketplace, admin] = await Promise.all([
    supabase
      .from("order_shipping_labels")
      .select("id, created_at, label_storage_path")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("order_admin_shipping_labels")
      .select("id, created_at, label_storage_path")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const marketplaceRow = rowRef(marketplace.data)
  const adminRow = rowRef(admin.data)
  const marketplaceAt = marketplaceRow?.created_at ? Date.parse(marketplaceRow.created_at) : 0
  const adminAt = adminRow?.created_at ? Date.parse(adminRow.created_at) : 0
  const useAdmin = Boolean(adminRow) && (!marketplaceRow || adminAt >= marketplaceAt)
  const target = useAdmin ? adminRow : marketplaceRow
  if (!target) return
  if (!replaceExistingPath && target.label_storage_path?.trim()) return

  const { error } = useAdmin
    ? await supabase
        .from("order_admin_shipping_labels")
        .update({ label_storage_path: storagePath })
        .eq("id", target.id)
    : await supabase
        .from("order_shipping_labels")
        .update({ label_storage_path: storagePath })
        .eq("id", target.id)
  if (error) {
    console.error("[shipping-label pdf] remember storage path:", error.message)
  }
}

function rowRef(data: unknown): { id: string; created_at: string | null; label_storage_path: string | null } | null {
  if (!data || typeof data !== "object") return null
  const row = data as { id?: unknown; created_at?: unknown; label_storage_path?: unknown }
  if (typeof row.id !== "string" || !row.id) return null
  return {
    id: row.id,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    label_storage_path: typeof row.label_storage_path === "string" ? row.label_storage_path : null,
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
