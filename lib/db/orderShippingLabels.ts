import type { SupabaseClient } from "@supabase/supabase-js"
import { getLatestAdminLabelUrlsForOrder } from "@/lib/db/adminOrderShippingLabels"

export type OrderShippingLabelOrigin = "auto_reswell_checkout" | "seller_paid"

export type OrderShippingLabelPaperlessFields = {
  paperless_qr_url: string | null
  paperless_qr_storage_path: string | null
  paperless_instructions: string | null
  paperless_handoff_code: string | null
}

export type OrderShippingLabelRow = {
  id: string
  order_id: string
  origin: OrderShippingLabelOrigin
  label_pdf_url: string | null
  label_storage_path: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  shipengine_rate_id: string | null
  created_at: string
} & OrderShippingLabelPaperlessFields

export type PreparedShippingLabelUrls = {
  label_pdf_url: string | null
  label_storage_path: string | null
} & OrderShippingLabelPaperlessFields

function normalizePaperless(row: Partial<OrderShippingLabelPaperlessFields>): OrderShippingLabelPaperlessFields {
  return {
    paperless_qr_url: row.paperless_qr_url?.trim() || null,
    paperless_qr_storage_path: row.paperless_qr_storage_path?.trim() || null,
    paperless_instructions: row.paperless_instructions?.trim() || null,
    paperless_handoff_code: row.paperless_handoff_code?.trim() || null,
  }
}

export function preparedLabelHasPaperlessQr(
  label: Pick<PreparedShippingLabelUrls, "paperless_qr_url" | "paperless_qr_storage_path"> | null,
): boolean {
  return Boolean(label?.paperless_qr_url?.trim() || label?.paperless_qr_storage_path?.trim())
}

export async function insertOrderShippingLabel(
  supabase: SupabaseClient,
  row: {
    order_id: string
    origin: OrderShippingLabelOrigin
    label_pdf_url?: string | null
    label_storage_path?: string | null
    tracking_number?: string | null
    tracking_carrier?: string | null
    shipengine_rate_id?: string | null
    stripe_payment_intent_id?: string | null
    paperless_qr_url?: string | null
    paperless_qr_storage_path?: string | null
    paperless_instructions?: string | null
    paperless_handoff_code?: string | null
  },
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("order_shipping_labels").insert({
    order_id: row.order_id,
    origin: row.origin,
    label_pdf_url: row.label_pdf_url ?? null,
    label_storage_path: row.label_storage_path ?? null,
    tracking_number: row.tracking_number ?? null,
    tracking_carrier: row.tracking_carrier ?? null,
    shipengine_rate_id: row.shipengine_rate_id ?? null,
    stripe_payment_intent_id: row.stripe_payment_intent_id ?? null,
    paperless_qr_url: row.paperless_qr_url ?? null,
    paperless_qr_storage_path: row.paperless_qr_storage_path ?? null,
    paperless_instructions: row.paperless_instructions ?? null,
    paperless_handoff_code: row.paperless_handoff_code ?? null,
  })

  if (!error) return { error: null }
  const parts = [error.message, error.hint, error.details, error.code].filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  )
  return { error: new Error(parts.length ? parts.join(" — ") : "Insert failed") }
}

export async function getLatestOrderShippingLabelUrlsForOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<(PreparedShippingLabelUrls & { created_at: string | null }) | null> {
  const { data, error } = await supabase
    .from("order_shipping_labels")
    .select(
      "label_pdf_url, label_storage_path, paperless_qr_url, paperless_qr_storage_path, paperless_instructions, paperless_handoff_code, created_at",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(8)

  if (error || !data?.length) return null
  for (const row of data) {
    const r = row as {
      label_pdf_url: string | null
      label_storage_path: string | null
      created_at?: string | null
    } & Partial<OrderShippingLabelPaperlessFields>
    const u = r.label_pdf_url?.trim() || null
    const p = r.label_storage_path?.trim() || null
    const paperless = normalizePaperless(r)
    if (u || p || paperless.paperless_qr_url || paperless.paperless_qr_storage_path) {
      return {
        label_pdf_url: u,
        label_storage_path: p,
        ...paperless,
        created_at: typeof r.created_at === "string" ? r.created_at : null,
      }
    }
  }
  return null
}

/**
 * Newest prepared label across marketplace + admin rows.
 * Replacement labels must win over an older auto-purchased marketplace PDF.
 */
export async function getLatestPreparedShippingLabelForOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<PreparedShippingLabelUrls | null> {
  const [marketplace, admin] = await Promise.all([
    getLatestOrderShippingLabelUrlsForOrder(supabase, orderId),
    getLatestAdminLabelUrlsForOrder(supabase, orderId),
  ])
  if (!marketplace && !admin) return null
  if (!marketplace) {
    const { created_at: _c, ...urls } = admin!
    return urls
  }
  if (!admin) {
    const { created_at: _c, ...urls } = marketplace
    return urls
  }
  const mAt = marketplace.created_at ? Date.parse(marketplace.created_at) : 0
  const aAt = admin.created_at ? Date.parse(admin.created_at) : 0
  if (aAt >= mAt) {
    const { created_at: _c, ...urls } = admin
    return urls
  }
  const { created_at: _c, ...urls } = marketplace
  return urls
}

const LABEL_BUCKET = "order-shipping-labels"
const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7

/** Resolves a downloadable URL for the seller sale page (signed storage URL or external PDF link). */
export async function getPreparedShippingLabelDownloadUrl(
  supabase: SupabaseClient,
  orderId: string,
): Promise<string | null> {
  const latest = await getLatestPreparedShippingLabelForOrder(supabase, orderId)
  if (!latest) return null

  if (latest.label_pdf_url) {
    return latest.label_pdf_url
  }

  if (latest.label_storage_path) {
    const { data: signed } = await supabase.storage
      .from(LABEL_BUCKET)
      .createSignedUrl(latest.label_storage_path, SIGNED_URL_TTL_SEC)
    return signed?.signedUrl ?? null
  }

  return null
}

/** Order ids that have a marketplace or admin-prepared label PDF on file. */
export async function fetchOrderIdsWithPreparedShippingLabels(
  supabase: SupabaseClient,
  orderIds: string[],
): Promise<Set<string>> {
  const ids = [...new Set(orderIds.filter(Boolean))]
  const prepared = new Set<string>()
  if (ids.length === 0) return prepared

  const [marketplaceRes, adminRes] = await Promise.all([
    supabase.from("order_shipping_labels").select("order_id").in("order_id", ids),
    supabase.from("order_admin_shipping_labels").select("order_id").in("order_id", ids),
  ])

  for (const row of marketplaceRes.data ?? []) {
    const orderId = (row as { order_id?: string }).order_id
    if (orderId) prepared.add(orderId)
  }
  for (const row of adminRes.data ?? []) {
    const orderId = (row as { order_id?: string }).order_id
    if (orderId) prepared.add(orderId)
  }

  return prepared
}

function rowHasPrintablePdf(row: {
  order_id?: string
  label_pdf_url?: string | null
  label_storage_path?: string | null
}): string | null {
  const orderId = row.order_id
  if (!orderId) return null
  if (row.label_pdf_url?.trim() || row.label_storage_path?.trim()) return orderId
  return null
}

/** Order ids that have a downloadable marketplace or admin label PDF (not QR-only). */
export async function fetchOrderIdsWithPrintableShippingLabelPdfs(
  supabase: SupabaseClient,
  orderIds: string[],
): Promise<Set<string>> {
  const ids = [...new Set(orderIds.filter(Boolean))]
  const printable = new Set<string>()
  if (ids.length === 0) return printable

  const [marketplaceRes, adminRes] = await Promise.all([
    supabase
      .from("order_shipping_labels")
      .select("order_id, label_pdf_url, label_storage_path")
      .in("order_id", ids),
    supabase
      .from("order_admin_shipping_labels")
      .select("order_id, label_pdf_url, label_storage_path")
      .in("order_id", ids),
  ])

  for (const row of marketplaceRes.data ?? []) {
    const orderId = rowHasPrintablePdf(row as Parameters<typeof rowHasPrintablePdf>[0])
    if (orderId) printable.add(orderId)
  }
  for (const row of adminRes.data ?? []) {
    const orderId = rowHasPrintablePdf(row as Parameters<typeof rowHasPrintablePdf>[0])
    if (orderId) printable.add(orderId)
  }

  return printable
}
