import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchLabelById,
  fetchLabelsByTrackingNumber,
  type ShipEngineLabelDetail,
} from "@/lib/shipengine/label-lookup"
import { voidShipEngineLabel } from "@/lib/shipengine/label-void"

function normalizeTracking(s: string | null | undefined): string {
  return (s ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
}

async function labelBelongsToOrder(params: {
  supabase: SupabaseClient
  orderId: string
  orderTracking: string | null
  labelTracking: string | null
}): Promise<boolean> {
  const lt = normalizeTracking(params.labelTracking)
  if (!lt) return false

  const ot = normalizeTracking(params.orderTracking)
  if (ot && ot === lt) return true

  const { data: rows, error } = await params.supabase
    .from("order_admin_shipping_labels")
    .select("tracking_number")
    .eq("order_id", params.orderId)

  if (!error && rows?.length) {
    for (const row of rows) {
      const r = row as { tracking_number?: string | null }
      if (normalizeTracking(r.tracking_number) === lt) return true
    }
  }

  const { data: prepared, error: preparedErr } = await params.supabase
    .from("order_shipping_labels")
    .select("tracking_number")
    .eq("order_id", params.orderId)

  if (preparedErr || !prepared?.length) return false

  for (const row of prepared) {
    const r = row as { tracking_number?: string | null }
    if (normalizeTracking(r.tracking_number) === lt) return true
  }
  return false
}

/**
 * Voids a ShipEngine label tied to an order (verifies tracking against the order or saved label rows),
 * requesting refund to the ShipEngine account balance when the carrier approves.
 *
 * Resolution order when `explicitLabelId` is omitted:
 * 1. `orders.tracking_number`
 * 2. Latest tracking on `order_shipping_labels`
 * 3. Latest tracking on `order_admin_shipping_labels`
 */
export async function voidShipEngineLabelForOrder(params: {
  supabase: SupabaseClient
  orderId: string
  explicitLabelId: string | null
}): Promise<
  | {
      ok: true
      data: {
        labelId: string
        approved: boolean
        message: string
        clearedOrderTracking: boolean
      }
    }
  | { ok: false; error: string; status: number }
> {
  const { data: order, error: orderErr } = await params.supabase
    .from("orders")
    .select("id, tracking_number, tracking_carrier")
    .eq("id", params.orderId)
    .maybeSingle()

  if (orderErr || !order) {
    return { ok: false, error: "Order not found", status: 404 }
  }

  const o = order as {
    id: string
    tracking_number: string | null
    tracking_carrier: string | null
  }

  let labelId: string
  let labelRow: ShipEngineLabelDetail

  if (params.explicitLabelId?.trim()) {
    const detail = await fetchLabelById(params.explicitLabelId.trim())
    if (!detail.ok) {
      return { ok: false, error: detail.error, status: detail.status }
    }
    if (detail.label.voided) {
      return { ok: false, error: "This label is already voided in ShipEngine.", status: 409 }
    }
    const belongs = await labelBelongsToOrder({
      supabase: params.supabase,
      orderId: o.id,
      orderTracking: o.tracking_number,
      labelTracking: detail.label.tracking_number,
    })
    if (!belongs) {
      return {
        ok: false,
        error:
          "This ShipEngine label’s tracking does not match this order’s tracking or saved admin label rows.",
        status: 400,
      }
    }
    labelId = detail.label.label_id
    labelRow = detail.label
  } else {
    const tracking = await resolveOrderLabelTrackingNumber(params.supabase, o)
    if (!tracking) {
      return {
        ok: false,
        error:
          "No tracking found on this order or its saved shipping labels — paste the ShipEngine label_id so we can void the correct label.",
        status: 400,
      }
    }

    const listed = await fetchLabelsByTrackingNumber(tracking)
    if (!listed.ok) {
      return { ok: false, error: listed.error, status: listed.status }
    }
    const candidate = listed.labels.find((l) => !l.voided && l.label_id)
    if (!candidate?.label_id) {
      return {
        ok: false,
        error:
          "No active (non-voided) ShipEngine label found for this tracking number, or paste label_id explicitly.",
        status: 404,
      }
    }

    labelId = candidate.label_id
    const detail = await fetchLabelById(labelId)
    if (!detail.ok) {
      return { ok: false, error: detail.error, status: detail.status }
    }
    if (detail.label.voided) {
      return { ok: false, error: "This label is already voided in ShipEngine.", status: 409 }
    }
    if (normalizeTracking(detail.label.tracking_number) !== normalizeTracking(tracking)) {
      return {
        ok: false,
        error: "Resolved label tracking does not match this order — pass label_id explicitly.",
        status: 409,
      }
    }
    labelRow = detail.label
  }

  const voided = await voidShipEngineLabel(labelId)
  if (!voided.ok) {
    return { ok: false, error: voided.error, status: voided.status }
  }

  const orderTrack = normalizeTracking(o.tracking_number)
  const labelTrack = normalizeTracking(labelRow.tracking_number)
  const shouldClear = Boolean(labelTrack && orderTrack && labelTrack === orderTrack)

  if (shouldClear) {
    const { error: upErr } = await params.supabase
      .from("orders")
      .update({
        tracking_number: null,
        tracking_carrier: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", o.id)

    if (upErr) {
      console.error("[voidShipEngineLabelForOrder] clear tracking:", upErr)
    }
  }

  return {
    ok: true,
    data: {
      labelId,
      approved: voided.result.approved,
      message: voided.result.message,
      clearedOrderTracking: shouldClear,
    },
  }
}

async function resolveOrderLabelTrackingNumber(
  supabase: SupabaseClient,
  order: { id: string; tracking_number: string | null },
): Promise<string | null> {
  const fromOrder = order.tracking_number?.trim() || null
  if (fromOrder) return fromOrder

  const [{ data: prepared }, { data: adminRows }] = await Promise.all([
    supabase
      .from("order_shipping_labels")
      .select("tracking_number")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("order_admin_shipping_labels")
      .select("tracking_number")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ])

  for (const row of prepared ?? []) {
    const t = (row as { tracking_number?: string | null }).tracking_number?.trim()
    if (t) return t
  }
  for (const row of adminRows ?? []) {
    const t = (row as { tracking_number?: string | null }).tracking_number?.trim()
    if (t) return t
  }
  return null
}
