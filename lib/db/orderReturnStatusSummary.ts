import type { SupabaseClient } from "@supabase/supabase-js"
import type { OrderReturnSummaryForStatus } from "@/lib/sale-card-status"

/**
 * Batch-load return status summaries for sale/purchase list cards.
 */
export async function getOrderReturnSummariesByOrderIds(
  supabase: SupabaseClient,
  orderIds: string[],
  lineCountByOrderId?: Map<string, number>,
): Promise<Map<string, OrderReturnSummaryForStatus>> {
  const out = new Map<string, OrderReturnSummaryForStatus>()
  const unique = [...new Set(orderIds.filter(Boolean))]
  if (unique.length === 0) return out

  const { data, error } = await supabase
    .from("order_item_returns")
    .select("order_id, listing_id, status")
    .in("order_id", unique)
    .neq("status", "cancelled")

  if (error || !data?.length) return out

  const byOrder = new Map<string, { listingIds: Set<string>; allRefunded: boolean }>()
  for (const raw of data) {
    const row = raw as { order_id: string; listing_id: string; status: string }
    let bucket = byOrder.get(row.order_id)
    if (!bucket) {
      bucket = { listingIds: new Set(), allRefunded: true }
      byOrder.set(row.order_id, bucket)
    }
    bucket.listingIds.add(row.listing_id)
    if (row.status !== "refunded") bucket.allRefunded = false
  }

  for (const [orderId, bucket] of byOrder) {
    const lineCount = lineCountByOrderId?.get(orderId) ?? 0
    const returnedCount = bucket.listingIds.size
    const isPartial = lineCount > 1 ? returnedCount < lineCount : false
    out.set(orderId, {
      hasReturn: returnedCount > 0,
      isPartial,
      allReturnsRefunded: bucket.allRefunded,
    })
  }

  return out
}
