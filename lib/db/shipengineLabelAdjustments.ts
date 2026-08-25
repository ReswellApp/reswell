import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"
import type { ParsedShipEngineAdjustmentRow } from "@/lib/shipengine/adjustment-reports"

export type ShipEngineLabelAdjustmentRow = {
  id: string
  report_id: string
  transaction_id: string
  adjustment_id: string | null
  shipment_id: string | null
  tracking_number: string | null
  adjustment_type: string | null
  reason_code: string | null
  adjustment_amount_usd: number
  adjustment_at: string | null
  actual_service: string | null
  actual_package: string | null
  actual_weight: number | null
  actual_length: number | null
  actual_width: number | null
  actual_height: number | null
  order_id: string | null
  created_at: string
}

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function mapRow(row: Record<string, unknown>): ShipEngineLabelAdjustmentRow {
  return {
    id: String(row.id),
    report_id: String(row.report_id),
    transaction_id: String(row.transaction_id),
    adjustment_id: typeof row.adjustment_id === "string" ? row.adjustment_id : null,
    shipment_id: typeof row.shipment_id === "string" ? row.shipment_id : null,
    tracking_number: typeof row.tracking_number === "string" ? row.tracking_number : null,
    adjustment_type: typeof row.adjustment_type === "string" ? row.adjustment_type : null,
    reason_code: typeof row.reason_code === "string" ? row.reason_code : null,
    adjustment_amount_usd: num(row.adjustment_amount_usd as number | string | null) ?? 0,
    adjustment_at: typeof row.adjustment_at === "string" ? row.adjustment_at : null,
    actual_service: typeof row.actual_service === "string" ? row.actual_service : null,
    actual_package: typeof row.actual_package === "string" ? row.actual_package : null,
    actual_weight: num(row.actual_weight as number | string | null),
    actual_length: num(row.actual_length as number | string | null),
    actual_width: num(row.actual_width as number | string | null),
    actual_height: num(row.actual_height as number | string | null),
    order_id: typeof row.order_id === "string" ? row.order_id : null,
    created_at: String(row.created_at),
  }
}

export async function dbListIngestedAdjustmentReportIds(
  supabase: SupabaseClient,
): Promise<{ ids: Set<string>; error: Error | null }> {
  const { data, error } = await supabase.from("shipengine_adjustment_reports").select("report_id")
  if (error) return { ids: new Set(), error: new Error(error.message) }
  return {
    ids: new Set((data ?? []).map((row) => String((row as { report_id: string }).report_id))),
    error: null,
  }
}

export async function dbUpsertAdjustmentReport(
  supabase: SupabaseClient,
  input: { reportId: string; reportCreatedAt: string | null; rowCount: number },
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("shipengine_adjustment_reports").upsert(
    {
      report_id: input.reportId,
      report_created_at: input.reportCreatedAt,
      ingested_at: new Date().toISOString(),
      row_count: input.rowCount,
    },
    { onConflict: "report_id" },
  )
  if (error) return { error: new Error(error.message) }
  return { error: null }
}

export async function dbUpsertLabelAdjustments(
  supabase: SupabaseClient,
  reportId: string,
  rows: Array<ParsedShipEngineAdjustmentRow & { orderId: string | null }>,
): Promise<{ error: Error | null }> {
  if (rows.length === 0) return { error: null }

  const payload = rows.map((row) => ({
    report_id: reportId,
    transaction_id: row.transactionId,
    adjustment_id: row.adjustmentId,
    shipment_id: row.shipmentId,
    tracking_number: row.trackingNumber,
    adjustment_type: row.adjustmentType,
    reason_code: row.reasonCode,
    adjustment_amount_usd: row.adjustmentAmountUsd,
    adjustment_at: row.adjustmentAt,
    actual_service: row.actualService,
    actual_package: row.actualPackage,
    actual_weight: row.actualWeight,
    actual_length: row.actualLength,
    actual_width: row.actualWidth,
    actual_height: row.actualHeight,
    order_id: row.orderId,
  }))

  const chunkSize = 200
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize)
    const { error } = await supabase.from("shipengine_label_adjustments").upsert(chunk, {
      onConflict: "report_id,transaction_id",
    })
    if (error) return { error: new Error(error.message) }
  }
  return { error: null }
}

export async function dbResolveOrderIdsByTrackingNumbers(
  supabase: SupabaseClient,
  trackingNumbers: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const unique = [
    ...new Set(
      trackingNumbers
        .map((tn) => normalizeTrackingNumberForCarrier(tn) || tn.trim())
        .filter(Boolean),
    ),
  ]
  if (unique.length === 0) return out

  const chunkSize = 100
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const [orders, marketplace, admin] = await Promise.all([
      supabase.from("orders").select("id, tracking_number").in("tracking_number", chunk),
      supabase.from("order_shipping_labels").select("order_id, tracking_number").in("tracking_number", chunk),
      supabase
        .from("order_admin_shipping_labels")
        .select("order_id, tracking_number")
        .in("tracking_number", chunk),
    ])

    const apply = (tracking: string | null | undefined, orderId: string | null | undefined) => {
      if (!tracking || !orderId) return
      const key = normalizeTrackingNumberForCarrier(tracking) || tracking.trim()
      if (key && !out.has(key)) out.set(key, orderId)
    }

    for (const row of orders.data ?? []) {
      const r = row as { id: string; tracking_number: string | null }
      apply(r.tracking_number, r.id)
    }
    for (const row of marketplace.data ?? []) {
      const r = row as { order_id: string; tracking_number: string | null }
      apply(r.tracking_number, r.order_id)
    }
    for (const row of admin.data ?? []) {
      const r = row as { order_id: string; tracking_number: string | null }
      apply(r.tracking_number, r.order_id)
    }
  }

  return out
}

export async function dbListIncreasedLabelAdjustments(
  supabase: SupabaseClient,
  opts: { limit: number; offset: number },
): Promise<{ data: ShipEngineLabelAdjustmentRow[]; total: number; error: Error | null }> {
  const { data, error, count } = await supabase
    .from("shipengine_label_adjustments")
    .select("*", { count: "exact" })
    .gt("adjustment_amount_usd", 0)
    .order("adjustment_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1)

  if (error) {
    return { data: [], total: 0, error: new Error(error.message) }
  }
  return {
    data: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)),
    total: count ?? 0,
    error: null,
  }
}
