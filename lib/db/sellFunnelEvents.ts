import type { SupabaseClient } from "@supabase/supabase-js"
import type { SellFunnelEventInput } from "@/lib/validations/sell-funnel-event"

export interface SellFunnelEventRow extends SellFunnelEventInput {
  userId: string | null
}

/**
 * Persists one sell funnel event. Throws on failure; callers decide whether
 * logging failures are fatal (they never should be for user-facing flows).
 */
export async function insertSellFunnelEvent(
  supabase: SupabaseClient,
  row: SellFunnelEventRow,
): Promise<void> {
  const { error } = await supabase.from("sell_funnel_events").insert({
    user_id: row.userId,
    listing_type: row.listingType,
    event: row.event,
    field: row.field ?? null,
    message: row.message ?? null,
    listing_id: row.listingId ?? null,
    duration_ms: row.durationMs ?? null,
    entry_point: row.entryPoint ?? null,
  })
  if (error) {
    throw new Error(error.message)
  }
}
