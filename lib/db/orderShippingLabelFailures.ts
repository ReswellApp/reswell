import type { SupabaseClient } from "@supabase/supabase-js"

export type OrderShippingLabelFailureStage =
  | "shipengine_not_configured"
  | "incomplete_address"
  | "rate_quote"
  | "rate_id"
  | "label_purchase"
  | "attach_label"

export type OrderShippingLabelFailureStatus = "open" | "resolved" | "dismissed"

export type OrderShippingLabelFailureRow = {
  id: string
  order_id: string
  failure_stage: OrderShippingLabelFailureStage
  error_message: string
  status: OrderShippingLabelFailureStatus
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
  updated_at: string
}

const MAX_ERROR_LEN = 2000

function trimError(message: string): string {
  const t = message.trim()
  if (t.length <= MAX_ERROR_LEN) return t
  return `${t.slice(0, MAX_ERROR_LEN - 1)}…`
}

/** Upserts the open failure row for an order (one open row per order). */
export async function recordOrderShippingLabelFailure(
  supabase: SupabaseClient,
  params: {
    orderId: string
    stage: OrderShippingLabelFailureStage
    errorMessage: string
  },
): Promise<void> {
  const orderId = params.orderId.trim()
  if (!orderId) return

  const payload = {
    failure_stage: params.stage,
    error_message: trimError(params.errorMessage),
    updated_at: new Date().toISOString(),
  }

  const { data: existing, error: findErr } = await supabase
    .from("order_shipping_label_failures")
    .select("id")
    .eq("order_id", orderId)
    .eq("status", "open")
    .maybeSingle()

  if (findErr) {
    console.error("[recordOrderShippingLabelFailure] find:", findErr.message)
    return
  }

  if (existing?.id) {
    const { error: updErr } = await supabase
      .from("order_shipping_label_failures")
      .update(payload)
      .eq("id", existing.id)
    if (updErr) {
      console.error("[recordOrderShippingLabelFailure] update:", updErr.message)
    }
    return
  }

  const { error: insErr } = await supabase.from("order_shipping_label_failures").insert({
    order_id: orderId,
    ...payload,
    status: "open",
  })

  if (insErr) {
    console.error("[recordOrderShippingLabelFailure] insert:", insErr.message)
  }
}

export async function resolveOpenOrderShippingLabelFailures(
  supabase: SupabaseClient,
  orderId: string,
  resolvedBy?: string | null,
): Promise<void> {
  const id = orderId.trim()
  if (!id) return

  const { error } = await supabase
    .from("order_shipping_label_failures")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", id)
    .eq("status", "open")

  if (error) {
    console.error("[resolveOpenOrderShippingLabelFailures]", error.message)
  }
}

export async function dismissOpenOrderShippingLabelFailure(
  supabase: SupabaseClient,
  orderId: string,
  dismissedBy: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = orderId.trim()
  if (!id) {
    return { ok: false, error: "Invalid order" }
  }

  const { data, error } = await supabase
    .from("order_shipping_label_failures")
    .update({
      status: "dismissed",
      resolved_at: new Date().toISOString(),
      resolved_by: dismissedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", id)
    .eq("status", "open")
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("[dismissOpenOrderShippingLabelFailure]", error.message)
    return { ok: false, error: "Could not dismiss failure" }
  }
  if (!data?.id) {
    return { ok: false, error: "No open failure for this order" }
  }
  return { ok: true }
}

/** Bulk-dismiss open failures for several orders at once. Returns how many rows were dismissed. */
export async function dismissOpenOrderShippingLabelFailures(
  supabase: SupabaseClient,
  orderIds: string[],
  dismissedBy: string,
): Promise<{ ok: true; dismissed: number } | { ok: false; error: string }> {
  const ids = [...new Set(orderIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) {
    return { ok: false, error: "No orders provided" }
  }

  const { data, error } = await supabase
    .from("order_shipping_label_failures")
    .update({
      status: "dismissed",
      resolved_at: new Date().toISOString(),
      resolved_by: dismissedBy,
      updated_at: new Date().toISOString(),
    })
    .in("order_id", ids)
    .eq("status", "open")
    .select("id")

  if (error) {
    console.error("[dismissOpenOrderShippingLabelFailures]", error.message)
    return { ok: false, error: "Could not dismiss failures" }
  }
  return { ok: true, dismissed: data?.length ?? 0 }
}

export async function countOpenOrderShippingLabelFailures(
  supabase: SupabaseClient,
): Promise<number> {
  const { count, error } = await supabase
    .from("order_shipping_label_failures")
    .select("*", { count: "exact", head: true })
    .eq("status", "open")

  if (error) {
    console.error("[countOpenOrderShippingLabelFailures]", error.message)
    return 0
  }
  return count ?? 0
}

export const SHIPPING_LABEL_FAILURE_STAGES: OrderShippingLabelFailureStage[] = [
  "shipengine_not_configured",
  "incomplete_address",
  "rate_quote",
  "rate_id",
  "label_purchase",
  "attach_label",
]

export type ShippingLabelFailureStats = {
  open: number
  resolved: number
  dismissed: number
  openByStage: Record<OrderShippingLabelFailureStage, number>
}

async function countFailuresByStatus(
  supabase: SupabaseClient,
  status: OrderShippingLabelFailureStatus,
): Promise<number> {
  const { count, error } = await supabase
    .from("order_shipping_label_failures")
    .select("*", { count: "exact", head: true })
    .eq("status", status)
  if (error) {
    console.error("[countFailuresByStatus]", status, error.message)
    return 0
  }
  return count ?? 0
}

/** Status + open-stage breakdown for the shipping analytics dashboard (count-only queries). */
export async function dbGetShippingLabelFailureStats(
  supabase: SupabaseClient,
): Promise<{ data: ShippingLabelFailureStats; error: Error | null }> {
  const openByStage = {
    shipengine_not_configured: 0,
    incomplete_address: 0,
    rate_quote: 0,
    rate_id: 0,
    label_purchase: 0,
    attach_label: 0,
  } as Record<OrderShippingLabelFailureStage, number>

  const [open, resolved, dismissed] = await Promise.all([
    countFailuresByStatus(supabase, "open"),
    countFailuresByStatus(supabase, "resolved"),
    countFailuresByStatus(supabase, "dismissed"),
  ])

  const { data: openRows, error } = await supabase
    .from("order_shipping_label_failures")
    .select("failure_stage")
    .eq("status", "open")
    .limit(2000)

  if (error) {
    return { data: { open, resolved, dismissed, openByStage }, error: new Error(error.message) }
  }

  for (const row of openRows ?? []) {
    const stage = (row as { failure_stage?: string }).failure_stage
    if (stage && stage in openByStage) {
      openByStage[stage as OrderShippingLabelFailureStage] += 1
    }
  }

  return { data: { open, resolved, dismissed, openByStage }, error: null }
}

export async function listOpenOrderShippingLabelFailures(
  supabase: SupabaseClient,
  opts: { limit: number; offset: number },
): Promise<{ data: OrderShippingLabelFailureRow[]; total: number; error: Error | null }> {
  const { data, error, count } = await supabase
    .from("order_shipping_label_failures")
    .select("*", { count: "exact" })
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1)

  if (error) {
    return { data: [], total: 0, error: new Error(error.message) }
  }

  return {
    data: (data ?? []) as OrderShippingLabelFailureRow[],
    total: count ?? 0,
    error: null,
  }
}
