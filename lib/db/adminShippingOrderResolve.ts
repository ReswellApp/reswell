import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Finds a single surfboard shipping order for attaching an admin-provided label.
 * Prefer explicit `order_id`; otherwise match by tracking on `orders` or latest admin label row.
 */
export async function resolveOrderIdForAdminShipengineLabel(params: {
  supabase: SupabaseClient
  explicitOrderId: string | null
  trackingNumber: string | null
}): Promise<
  | { ok: true; orderId: string }
  | { ok: false; error: string; status: 404 | 409 }
> {
  const explicit = params.explicitOrderId?.trim() || null
  if (explicit) {
    return { ok: true, orderId: explicit }
  }

  const track = params.trackingNumber?.trim() || null
  if (!track) {
    return {
      ok: false,
      error:
        "No tracking number on this label yet — paste the Reswell order UUID (from admin orders) so we know which seller thread to use.",
      status: 404,
    }
  }

  const { data: orderHits, error: oErr } = await params.supabase
    .from("orders")
    .select("id")
    .ilike("tracking_number", track)
    .limit(3)

  if (oErr) {
    return {
      ok: false,
      error: "Could not look up order by tracking.",
      status: 404,
    }
  }

  const orderIds = [...new Set((orderHits ?? []).map((r) => r.id as string))]
  if (orderIds.length === 1) {
    return { ok: true, orderId: orderIds[0] }
  }
  if (orderIds.length > 1) {
    return {
      ok: false,
      error:
        "Multiple orders share this tracking number. Paste the order UUID from admin orders.",
      status: 409,
    }
  }

  const { data: labelHits, error: lErr } = await params.supabase
    .from("order_admin_shipping_labels")
    .select("order_id")
    .ilike("tracking_number", track)
    .order("created_at", { ascending: false })
    .limit(5)

  if (lErr) {
    return {
      ok: false,
      error: "Could not look up order by tracking.",
      status: 404,
    }
  }

  const fromLabels = [...new Set((labelHits ?? []).map((r) => r.order_id as string))]
  if (fromLabels.length === 1) {
    return { ok: true, orderId: fromLabels[0] }
  }
  if (fromLabels.length > 1) {
    return {
      ok: false,
      error:
        "Multiple label records share this tracking number. Paste the order UUID from admin orders.",
      status: 409,
    }
  }

  return {
    ok: false,
    error:
      "No Reswell order matched this tracking number. Paste the order UUID from admin orders (order may not have tracking saved yet).",
    status: 404,
  }
}
