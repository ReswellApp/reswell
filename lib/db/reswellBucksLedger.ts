import type { SupabaseClient } from "@supabase/supabase-js"

export type ReswellBucksSettlePayload = {
  idempotency_key: string
  buyer_id: string
  seller_id: string
  amount_cents: number
  shipping_cents: number
  platform_fee_cents: number
  seller_earnings_cents: number
  promo_discount_cents: number
  fulfillment_method: "pickup" | "shipping"
  delivery_status: "pickup_ready" | "pending"
  pickup_code: string | null
  shipping_packaging_mode: "together" | "separate" | null
  shipping_address: Record<string, unknown> | null
  promo_code_id: string | null
  admin_promo_code_id: string | null
  title_summary: string
  lines: Array<{
    listing_id: string
    quantity: 1
    item_price_cents: number
    shipping_cents: number
    platform_fee_cents: number
    seller_earnings_cents: number
  }>
}

export type ReswellBucksSettleRow = {
  order_id: string
  order_num?: string | null
  replayed?: boolean
  buyer_balance_after_cents?: number | null
}

export async function settleAdminReswellBucksCheckout(
  supabase: SupabaseClient,
  payload: ReswellBucksSettlePayload,
): Promise<{ ok: true; row: ReswellBucksSettleRow } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("admin_settle_reswell_bucks_checkout", {
    p_payload: payload,
  })
  if (error) {
    return { ok: false, message: error.message }
  }
  if (!data || typeof data !== "object") {
    return { ok: false, message: "empty_settlement" }
  }
  const row = data as ReswellBucksSettleRow
  if (!row.order_id) {
    return { ok: false, message: "empty_settlement" }
  }
  return { ok: true, row }
}

export async function postReswellBucksShippingLabelCost(
  supabase: SupabaseClient,
  orderId: string,
  labelId: string,
  costCents: number,
): Promise<void> {
  const { error } = await supabase.rpc("post_reswell_bucks_shipping_label_cost", {
    p_order_id: orderId,
    p_label_id: labelId,
    p_cost_cents: costCents,
  })
  if (error) {
    console.error("[reswell-bucks] shipping label cost", { orderId, labelId, message: error.message })
  }
}

export type ReswellBucksReconcileSummary = {
  settlement_count: number
  unbalanced_count: number
  total_debit_cents: number
  total_credit_cents: number
  buyer_spent_cents: number
  seller_pending_cents: number
  platform_fee_cents: number
  shipping_clearing_cents: number
  promo_subsidy_cents: number
  shipping_variance_cents: number
  carrier_matched_cents: number
  shipments_awaiting_label_cost: number
}

export async function fetchReswellBucksReconcileSummary(
  supabase: SupabaseClient,
): Promise<ReswellBucksReconcileSummary | null> {
  const { data, error } = await supabase.rpc("reswell_bucks_reconcile_summary")
  if (error || !data || typeof data !== "object") {
    if (error) console.error("[reswell-bucks] reconcile", error.message)
    return null
  }
  const row = data as Partial<ReswellBucksReconcileSummary>
  return {
    settlement_count: Number(row.settlement_count ?? 0),
    unbalanced_count: Number(row.unbalanced_count ?? 0),
    total_debit_cents: Number(row.total_debit_cents ?? 0),
    total_credit_cents: Number(row.total_credit_cents ?? 0),
    buyer_spent_cents: Number(row.buyer_spent_cents ?? 0),
    seller_pending_cents: Number(row.seller_pending_cents ?? 0),
    platform_fee_cents: Number(row.platform_fee_cents ?? 0),
    shipping_clearing_cents: Number(row.shipping_clearing_cents ?? 0),
    promo_subsidy_cents: Number(row.promo_subsidy_cents ?? 0),
    shipping_variance_cents: Number(row.shipping_variance_cents ?? 0),
    carrier_matched_cents: Number(row.carrier_matched_cents ?? 0),
    shipments_awaiting_label_cost: Number(row.shipments_awaiting_label_cost ?? 0),
  }
}
