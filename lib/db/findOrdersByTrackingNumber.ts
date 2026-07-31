import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"

/**
 * Resolves marketplace order ids for a carrier tracking number.
 * Tries orders.tracking_number (exact + case-insensitive) and label tables,
 * then a normalized in-memory match for whitespace mismatches.
 */
export async function findOrderIdsByTrackingNumber(
  supabase: SupabaseClient,
  trackingNumberRaw: string,
): Promise<{ orderIds: string[]; error?: string }> {
  const trimmed = trackingNumberRaw.trim()
  const normalized = normalizeTrackingNumberForCarrier(trimmed)
  if (!normalized) {
    return { orderIds: [] }
  }

  const variants = [...new Set([normalized, trimmed].filter(Boolean))]
  const ids = new Set<string>()

  const { data: exactRows, error: exactErr } = await supabase
    .from("orders")
    .select("id")
    .in("tracking_number", variants)

  if (exactErr) {
    console.error("[findOrderIdsByTrackingNumber] exact:", exactErr.message)
    return { orderIds: [], error: "Database lookup failed" }
  }
  for (const row of exactRows ?? []) {
    ids.add((row as { id: string }).id)
  }

  if (ids.size === 0) {
    const { data: ilikeRows, error: ilikeErr } = await supabase
      .from("orders")
      .select("id")
      .ilike("tracking_number", normalized)
      .limit(10)

    if (ilikeErr) {
      console.error("[findOrderIdsByTrackingNumber] ilike:", ilikeErr.message)
      return { orderIds: [], error: "Database lookup failed" }
    }
    for (const row of ilikeRows ?? []) {
      ids.add((row as { id: string }).id)
    }
  }

  if (ids.size === 0) {
    const { data: labelRows, error: labelErr } = await supabase
      .from("order_shipping_labels")
      .select("order_id")
      .in("tracking_number", variants)
      .limit(10)

    if (labelErr) {
      console.error("[findOrderIdsByTrackingNumber] labels:", labelErr.message)
    } else {
      for (const row of labelRows ?? []) {
        const orderId = (row as { order_id: string }).order_id
        if (orderId) ids.add(orderId)
      }
    }
  }

  if (ids.size === 0) {
    const { data: adminLabelRows, error: adminLabelErr } = await supabase
      .from("order_admin_shipping_labels")
      .select("order_id")
      .in("tracking_number", variants)
      .limit(10)

    if (adminLabelErr) {
      console.error("[findOrderIdsByTrackingNumber] admin labels:", adminLabelErr.message)
    } else {
      for (const row of adminLabelRows ?? []) {
        const orderId = (row as { order_id: string }).order_id
        if (orderId) ids.add(orderId)
      }
    }
  }

  // Whitespace / formatting drift: scan recent open shipping orders and normalize-compare.
  if (ids.size === 0) {
    const { data: openRows, error: openErr } = await supabase
      .from("orders")
      .select("id, tracking_number")
      .eq("fulfillment_method", "shipping")
      .eq("status", "confirmed")
      .not("tracking_number", "is", null)
      .order("updated_at", { ascending: false })
      .limit(500)

    if (openErr) {
      console.error("[findOrderIdsByTrackingNumber] open scan:", openErr.message)
    } else {
      for (const row of openRows ?? []) {
        const tn = (row as { tracking_number: string | null }).tracking_number
        if (!tn) continue
        if (normalizeTrackingNumberForCarrier(tn) === normalized) {
          ids.add((row as { id: string }).id)
        }
      }
    }
  }

  return { orderIds: [...ids] }
}
