import type { SupabaseClient } from "@supabase/supabase-js"
import type { OrderPayoutReleaseState } from "@/lib/closure-account-orders"

const CHUNK = 100

export async function getPayoutReleaseByOrderIds(
  supabase: SupabaseClient,
  orderIds: string[],
): Promise<Map<string, OrderPayoutReleaseState>> {
  const out = new Map<string, OrderPayoutReleaseState>()
  const unique = [...new Set(orderIds.filter(Boolean))]
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from("payouts")
      .select("order_id, status, released_at")
      .in("order_id", chunk)
    if (error) {
      console.error("[getPayoutReleaseByOrderIds]", {
        message: error.message,
        timestamp: new Date().toISOString(),
      })
      continue
    }
    for (const raw of data ?? []) {
      const row = raw as { order_id: string; status: string; released_at: string | null }
      out.set(row.order_id, { status: row.status, released_at: row.released_at })
    }
  }
  return out
}
