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
  created_at: string
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
  })
  if (!error) return { error: null }
  const parts = [error.message, error.hint, error.details, error.code].filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  )
  return { error: new Error(parts.length ? parts.join(" — ") : "Insert failed") }
}

export async function listOrderAdminShippingLabels(
  supabase: SupabaseClient,
  opts: { limit: number; offset: number },
): Promise<{ data: AdminShippingLabelListRow[]; total: number; error: Error | null }> {
  const { data, error, count } = await supabase
    .from("order_admin_shipping_labels")
    .select("*", { count: "exact" })
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
): Promise<{ label_pdf_url: string | null; label_storage_path: string | null } | null> {
  const { data, error } = await supabase
    .from("order_admin_shipping_labels")
    .select("label_pdf_url, label_storage_path")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(8)

  if (error || !data?.length) return null
  for (const row of data) {
    const r = row as { label_pdf_url: string | null; label_storage_path: string | null }
    const u = r.label_pdf_url?.trim() || null
    const p = r.label_storage_path?.trim() || null
    if (u || p) return { label_pdf_url: u, label_storage_path: p }
  }
  return null
}
