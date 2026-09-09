import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"

function num(v: number | string | null | undefined): number {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

export type LabelSpendAdjustmentRow = {
  trackingNumber: string | null
  adjustmentAmountUsd: number
  adjustmentAt: string | null
}

export async function dbListLabelAdjustmentsInRange(
  supabase: SupabaseClient,
  params: { startIso: string; endIso: string },
): Promise<{ data: LabelSpendAdjustmentRow[]; error: Error | null }> {
  const select = "tracking_number, adjustment_amount_usd, adjustment_at, created_at"
  const [byAdjustmentAt, byCreatedAt] = await Promise.all([
    supabase
      .from("shipengine_label_adjustments")
      .select(select)
      .gte("adjustment_at", params.startIso)
      .lt("adjustment_at", params.endIso),
    supabase
      .from("shipengine_label_adjustments")
      .select(select)
      .is("adjustment_at", null)
      .gte("created_at", params.startIso)
      .lt("created_at", params.endIso),
  ])

  if (byAdjustmentAt.error) {
    return { data: [], error: new Error(byAdjustmentAt.error.message) }
  }
  if (byCreatedAt.error) {
    return { data: [], error: new Error(byCreatedAt.error.message) }
  }

  const seen = new Set<string>()
  const rows: LabelSpendAdjustmentRow[] = []
  for (const row of [...(byAdjustmentAt.data ?? []), ...(byCreatedAt.data ?? [])]) {
    const r = row as {
      tracking_number: string | null
      adjustment_amount_usd: number | string | null
      adjustment_at: string | null
      created_at: string
    }
    const key = `${r.tracking_number ?? ""}:${r.adjustment_at ?? r.created_at}:${r.adjustment_amount_usd}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({
      trackingNumber: r.tracking_number,
      adjustmentAmountUsd: num(r.adjustment_amount_usd),
      adjustmentAt: r.adjustment_at ?? r.created_at,
    })
  }

  return { data: rows, error: null }
}

export type LabelSpendOrderMatch = {
  orderId: string
  orderNum: string | null
  shippingAmountUsd: number
}

/**
 * Map normalized tracking numbers to marketplace / admin / return / standalone labels.
 */
export async function dbMatchTrackingToOrders(
  supabase: SupabaseClient,
  trackingNumbers: string[],
): Promise<{ data: Map<string, LabelSpendOrderMatch>; error: Error | null }> {
  const out = new Map<string, LabelSpendOrderMatch>()
  const unique = [
    ...new Set(
      trackingNumbers
        .map((tn) => normalizeTrackingNumberForCarrier(tn) || tn.trim())
        .filter(Boolean),
    ),
  ]
  if (unique.length === 0) return { data: out, error: null }

  const orderIds = new Set<string>()
  const trackingToOrder = new Map<string, string>()

  const apply = (tracking: string | null | undefined, orderId: string | null | undefined) => {
    if (!tracking || !orderId) return
    const key = normalizeTrackingNumberForCarrier(tracking) || tracking.trim()
    if (!key || trackingToOrder.has(key)) return
    trackingToOrder.set(key, orderId)
    orderIds.add(orderId)
  }

  const chunkSize = 100
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const [orders, marketplace, admin, returns] = await Promise.all([
      supabase.from("orders").select("id, tracking_number").in("tracking_number", chunk),
      supabase.from("order_shipping_labels").select("order_id, tracking_number").in("tracking_number", chunk),
      supabase
        .from("order_admin_shipping_labels")
        .select("order_id, tracking_number")
        .in("tracking_number", chunk),
      supabase.from("order_item_returns").select("order_id, tracking_number").in("tracking_number", chunk),
    ])

    if (orders.error) return { data: out, error: new Error(orders.error.message) }
    if (marketplace.error) return { data: out, error: new Error(marketplace.error.message) }
    if (admin.error) return { data: out, error: new Error(admin.error.message) }
    if (returns.error) return { data: out, error: new Error(returns.error.message) }

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
    for (const row of returns.data ?? []) {
      const r = row as { order_id: string; tracking_number: string | null }
      apply(r.tracking_number, r.order_id)
    }
  }

  const ids = [...orderIds]
  if (ids.length === 0) return { data: out, error: null }

  const byId = new Map<string, LabelSpendOrderMatch>()
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_num, shipping_amount")
      .in("id", chunk)
    if (error) return { data: out, error: new Error(error.message) }
    for (const row of data ?? []) {
      const r = row as {
        id: string
        order_num: string | null
        shipping_amount: number | string | null
      }
      byId.set(r.id, {
        orderId: r.id,
        orderNum: r.order_num,
        shippingAmountUsd: num(r.shipping_amount),
      })
    }
  }

  for (const [tracking, orderId] of trackingToOrder.entries()) {
    const match = byId.get(orderId)
    if (match) out.set(tracking, match)
  }

  return { data: out, error: null }
}
