import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  AdjustmentDisputeCarrier,
  AdjustmentDisputeReasonCode,
  AdjustmentDisputeStatus,
} from "@/lib/shipping/adjustment-fee"

export type ShippingAdjustmentDisputeRow = {
  id: string
  adjustment_id: string
  order_id: string | null
  seller_id: string
  carrier: AdjustmentDisputeCarrier
  reason_code: AdjustmentDisputeReasonCode
  seller_statement: string
  claimed_length_in: number | null
  claimed_width_in: number | null
  claimed_height_in: number | null
  claimed_weight_lb: number | null
  status: AdjustmentDisputeStatus
  reswell_note: string | null
  carrier_reference: string | null
  submitted_to_carrier_at: string | null
  submitted_to_carrier_by: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

function num(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function mapDispute(row: Record<string, unknown>): ShippingAdjustmentDisputeRow {
  return {
    id: String(row.id),
    adjustment_id: String(row.adjustment_id),
    order_id: typeof row.order_id === "string" ? row.order_id : null,
    seller_id: String(row.seller_id),
    carrier: row.carrier as AdjustmentDisputeCarrier,
    reason_code: row.reason_code as AdjustmentDisputeReasonCode,
    seller_statement: String(row.seller_statement ?? ""),
    claimed_length_in: num(row.claimed_length_in as number | string | null),
    claimed_width_in: num(row.claimed_width_in as number | string | null),
    claimed_height_in: num(row.claimed_height_in as number | string | null),
    claimed_weight_lb: num(row.claimed_weight_lb as number | string | null),
    status: row.status as AdjustmentDisputeStatus,
    reswell_note: typeof row.reswell_note === "string" ? row.reswell_note : null,
    carrier_reference: typeof row.carrier_reference === "string" ? row.carrier_reference : null,
    submitted_to_carrier_at:
      typeof row.submitted_to_carrier_at === "string" ? row.submitted_to_carrier_at : null,
    submitted_to_carrier_by:
      typeof row.submitted_to_carrier_by === "string" ? row.submitted_to_carrier_by : null,
    resolved_at: typeof row.resolved_at === "string" ? row.resolved_at : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export async function dbListDisputesForAdjustments(
  supabase: SupabaseClient,
  adjustmentIds: string[],
): Promise<{ data: ShippingAdjustmentDisputeRow[]; error: Error | null }> {
  const ids = [...new Set(adjustmentIds.filter(Boolean))]
  if (ids.length === 0) return { data: [], error: null }
  const { data, error } = await supabase
    .from("shipping_adjustment_disputes")
    .select("*")
    .in("adjustment_id", ids)
  if (error) return { data: [], error: new Error(error.message) }
  return {
    data: (data ?? []).map((row) => mapDispute(row as Record<string, unknown>)),
    error: null,
  }
}

export async function dbInsertShippingAdjustmentDispute(
  supabase: SupabaseClient,
  input: {
    adjustmentId: string
    orderId: string
    sellerId: string
    carrier: AdjustmentDisputeCarrier
    reasonCode: AdjustmentDisputeReasonCode
    sellerStatement: string
    claimedLengthIn?: number
    claimedWidthIn?: number
    claimedHeightIn?: number
    claimedWeightLb?: number
  },
): Promise<{ data: ShippingAdjustmentDisputeRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("shipping_adjustment_disputes")
    .insert({
      adjustment_id: input.adjustmentId,
      order_id: input.orderId,
      seller_id: input.sellerId,
      carrier: input.carrier,
      reason_code: input.reasonCode,
      seller_statement: input.sellerStatement,
      claimed_length_in: input.claimedLengthIn ?? null,
      claimed_width_in: input.claimedWidthIn ?? null,
      claimed_height_in: input.claimedHeightIn ?? null,
      claimed_weight_lb: input.claimedWeightLb ?? null,
      status: "submitted_to_reswell",
    })
    .select("*")
    .single()
  if (error) return { data: null, error: new Error(error.message) }
  return { data: mapDispute(data as Record<string, unknown>), error: null }
}

export async function dbListShippingAdjustmentDisputes(
  supabase: SupabaseClient,
  opts: { limit: number; offset: number; status?: AdjustmentDisputeStatus | "open" },
): Promise<{ data: ShippingAdjustmentDisputeRow[]; total: number; error: Error | null }> {
  let query = supabase
    .from("shipping_adjustment_disputes")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1)

  if (opts.status === "open") {
    query = query.in("status", ["submitted_to_reswell", "submitted_to_carrier"])
  } else if (opts.status) {
    query = query.eq("status", opts.status)
  }

  const { data, error, count } = await query
  if (error) return { data: [], total: 0, error: new Error(error.message) }
  return {
    data: (data ?? []).map((row) => mapDispute(row as Record<string, unknown>)),
    total: count ?? 0,
    error: null,
  }
}

export async function dbGetShippingAdjustmentDispute(
  supabase: SupabaseClient,
  disputeId: string,
): Promise<{ data: ShippingAdjustmentDisputeRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("shipping_adjustment_disputes")
    .select("*")
    .eq("id", disputeId)
    .maybeSingle()
  if (error) return { data: null, error: new Error(error.message) }
  if (!data) return { data: null, error: null }
  return { data: mapDispute(data as Record<string, unknown>), error: null }
}

export async function dbUpdateShippingAdjustmentDispute(
  supabase: SupabaseClient,
  disputeId: string,
  patch: {
    status: AdjustmentDisputeStatus
    reswellNote?: string | null
    carrierReference?: string | null
    submittedToCarrierAt?: string | null
    submittedToCarrierBy?: string | null
    resolvedAt?: string | null
  },
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("shipping_adjustment_disputes")
    .update({
      status: patch.status,
      reswell_note: patch.reswellNote ?? null,
      carrier_reference: patch.carrierReference ?? null,
      submitted_to_carrier_at: patch.submittedToCarrierAt ?? null,
      submitted_to_carrier_by: patch.submittedToCarrierBy ?? null,
      resolved_at: patch.resolvedAt ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", disputeId)
  if (error) return { error: new Error(error.message) }
  return { error: null }
}
