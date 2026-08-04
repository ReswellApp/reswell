import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"

/**
 * Resolves `order_item_returns` ids for a carrier tracking number on a return label.
 */
export async function findReturnIdsByTrackingNumber(
  supabase: SupabaseClient,
  trackingNumberRaw: string,
): Promise<{ returnIds: string[]; error?: string }> {
  const trimmed = trackingNumberRaw.trim()
  const normalized = normalizeTrackingNumberForCarrier(trimmed)
  if (!normalized) {
    return { returnIds: [] }
  }

  const variants = [...new Set([normalized, trimmed].filter(Boolean))]
  const ids = new Set<string>()

  const { data: exactRows, error: exactErr } = await supabase
    .from("order_item_returns")
    .select("id")
    .in("tracking_number", variants)

  if (exactErr) {
    console.error("[findReturnIdsByTrackingNumber] exact:", exactErr.message)
    return { returnIds: [], error: "Database lookup failed" }
  }
  for (const row of exactRows ?? []) {
    ids.add((row as { id: string }).id)
  }

  if (ids.size === 0) {
    const { data: ilikeRows, error: ilikeErr } = await supabase
      .from("order_item_returns")
      .select("id")
      .ilike("tracking_number", normalized)
      .limit(10)

    if (ilikeErr) {
      console.error("[findReturnIdsByTrackingNumber] ilike:", ilikeErr.message)
      return { returnIds: [], error: "Database lookup failed" }
    }
    for (const row of ilikeRows ?? []) {
      ids.add((row as { id: string }).id)
    }
  }

  if (ids.size === 0) {
    const { data: openRows, error: openErr } = await supabase
      .from("order_item_returns")
      .select("id, tracking_number")
      .in("status", ["authorized", "in_transit", "delivered", "refund_pending"])
      .not("tracking_number", "is", null)
      .order("updated_at", { ascending: false })
      .limit(500)

    if (openErr) {
      console.error("[findReturnIdsByTrackingNumber] open scan:", openErr.message)
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

  return { returnIds: [...ids] }
}
