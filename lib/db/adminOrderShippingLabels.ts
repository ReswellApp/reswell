import type { SupabaseClient } from "@supabase/supabase-js"

export type AdminShippingLabelSource =
  | "shipengine_checkout_lane"
  | "manual_label_upload"
  | "manual_tracking_buyer"

export type AdminShippingLabelListRow = {
  id: string
  order_id: string
  created_by: string
  source: AdminShippingLabelSource
  label_pdf_url: string | null
  label_storage_path: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  shipengine_rate_id: string | null
  label_cost_usd: number | null
  label_cost_currency: string | null
  created_at: string
  paperless_qr_url: string | null
  paperless_qr_storage_path: string | null
  paperless_instructions: string | null
  paperless_handoff_code: string | null
}

export type AdminShippingLabelFilters = {
  source?: AdminShippingLabelSource | null
  carrier?: string | null
  search?: string | null
  dateFrom?: string | null
  dateTo?: string | null
}

export async function insertOrderAdminShippingLabel(
  supabase: SupabaseClient,
  row: {
    order_id: string
    created_by: string
    source: AdminShippingLabelSource
    label_pdf_url?: string | null
    label_storage_path?: string | null
    tracking_number?: string | null
    tracking_carrier?: string | null
    shipengine_rate_id?: string | null
    label_cost_usd?: number | null
    label_cost_currency?: string | null
    paperless_qr_url?: string | null
    paperless_qr_storage_path?: string | null
    paperless_instructions?: string | null
    paperless_handoff_code?: string | null
  },
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("order_admin_shipping_labels").insert({
    order_id: row.order_id,
    created_by: row.created_by,
    source: row.source,
    label_pdf_url: row.label_pdf_url ?? null,
    label_storage_path: row.label_storage_path ?? null,
    tracking_number: row.tracking_number ?? null,
    tracking_carrier: row.tracking_carrier ?? null,
    shipengine_rate_id: row.shipengine_rate_id ?? null,
    label_cost_usd: row.label_cost_usd ?? null,
    label_cost_currency: row.label_cost_currency ?? null,
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

export async function listOrderAdminShippingLabels(
  supabase: SupabaseClient,
  opts: { limit: number; offset: number; filters?: AdminShippingLabelFilters },
): Promise<{ data: AdminShippingLabelListRow[]; total: number; error: Error | null }> {
  let query = supabase
    .from("order_admin_shipping_labels")
    .select("*", { count: "exact" })

  const f = opts.filters
  if (f?.source) query = query.eq("source", f.source)
  if (f?.carrier && f.carrier.trim()) {
    query = query.ilike("tracking_carrier", `%${f.carrier.trim()}%`)
  }
  if (f?.search && f.search.trim()) {
    const raw = f.search.trim()
    const uuid = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0]
    if (uuid) {
      // order_id is a uuid column — ilike would error, so match exactly.
      query = query.eq("order_id", uuid.toLowerCase())
    } else {
      const term = raw.replace(/[%,]/g, "")
      query = query.ilike("tracking_number", `%${term}%`)
    }
  }
  if (f?.dateFrom) query = query.gte("created_at", f.dateFrom)
  if (f?.dateTo) query = query.lte("created_at", f.dateTo)

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1)

  if (error) {
    return { data: [], total: 0, error: new Error(error.message) }
  }
  return {
    data: (data ?? []) as AdminShippingLabelListRow[],
    total: count ?? 0,
    error: null,
  }
}

export type AdminShippingLabelStatsRow = {
  source: AdminShippingLabelSource
  tracking_carrier: string | null
  label_cost_usd: number | null
  order_id: string
  created_at: string
}

/**
 * Pulls a bounded recent window of label rows for in-memory aggregation
 * (source mix, carrier mix, daily volume, spend). Capped so the dashboard
 * stays fast even as the table grows.
 */
export async function dbGetRecentShippingLabelsForStats(
  supabase: SupabaseClient,
  opts: { sinceIso: string; cap: number },
): Promise<{ data: AdminShippingLabelStatsRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("order_admin_shipping_labels")
    .select("source, tracking_carrier, label_cost_usd, order_id, created_at")
    .gte("created_at", opts.sinceIso)
    .order("created_at", { ascending: false })
    .limit(opts.cap)

  if (error) {
    return { data: [], error: new Error(error.message) }
  }
  return { data: (data ?? []) as AdminShippingLabelStatsRow[], error: null }
}

/** All-time count of admin shipping label rows (cheap head count). */
export async function dbCountAllShippingLabels(
  supabase: SupabaseClient,
): Promise<{ count: number; error: Error | null }> {
  const { count, error } = await supabase
    .from("order_admin_shipping_labels")
    .select("*", { count: "exact", head: true })

  if (error) {
    return { count: 0, error: new Error(error.message) }
  }
  return { count: count ?? 0, error: null }
}

/** Buyer-paid shipping amounts keyed by order id, for cost reconciliation. */
export async function dbGetOrderShippingAmounts(
  supabase: SupabaseClient,
  orderIds: string[],
): Promise<{ data: Map<string, number>; error: Error | null }> {
  const ids = [...new Set(orderIds)].filter(Boolean)
  const out = new Map<string, number>()
  if (ids.length === 0) return { data: out, error: null }

  const { data, error } = await supabase
    .from("orders")
    .select("id, shipping_amount")
    .in("id", ids)

  if (error) {
    return { data: out, error: new Error(error.message) }
  }
  for (const row of data ?? []) {
    const r = row as { id: string; shipping_amount: string | number | null }
    const amount = Number(r.shipping_amount)
    out.set(r.id, Number.isFinite(amount) ? amount : 0)
  }
  return { data: out, error: null }
}

export async function getLatestStoredLabelPathForOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<{ path: string } | null> {
  const { data, error } = await supabase
    .from("order_admin_shipping_labels")
    .select("label_storage_path")
    .eq("order_id", orderId)
    .not("label_storage_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  const path =
    data &&
    typeof (data as { label_storage_path?: string }).label_storage_path === "string" &&
    (data as { label_storage_path: string }).label_storage_path.trim()
      ? (data as { label_storage_path: string }).label_storage_path.trim()
      : null
  return path ? { path } : null
}

export async function getLatestAdminLabelUrlsForOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<{
  label_pdf_url: string | null
  label_storage_path: string | null
  paperless_qr_url: string | null
  paperless_qr_storage_path: string | null
  paperless_instructions: string | null
  paperless_handoff_code: string | null
} | null> {
  const { data, error } = await supabase
    .from("order_admin_shipping_labels")
    .select(
      "label_pdf_url, label_storage_path, paperless_qr_url, paperless_qr_storage_path, paperless_instructions, paperless_handoff_code",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(8)

  if (error || !data?.length) return null
  for (const row of data) {
    const r = row as {
      label_pdf_url: string | null
      label_storage_path: string | null
      paperless_qr_url?: string | null
      paperless_qr_storage_path?: string | null
      paperless_instructions?: string | null
      paperless_handoff_code?: string | null
    }
    const u = r.label_pdf_url?.trim() || null
    const p = r.label_storage_path?.trim() || null
    const qrUrl = r.paperless_qr_url?.trim() || null
    const qrPath = r.paperless_qr_storage_path?.trim() || null
    const instructions = r.paperless_instructions?.trim() || null
    const handoff = r.paperless_handoff_code?.trim() || null
    if (u || p || qrUrl || qrPath) {
      return {
        label_pdf_url: u,
        label_storage_path: p,
        paperless_qr_url: qrUrl,
        paperless_qr_storage_path: qrPath,
        paperless_instructions: instructions,
        paperless_handoff_code: handoff,
      }
    }
  }
  return null
}
