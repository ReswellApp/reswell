import type { SupabaseClient } from "@supabase/supabase-js"
import { REAL_MARKETPLACE_SALES_FILTER } from "@/lib/order-admin-test"
import {
  autoSendSellerReviewRequestForOrder,
  sellerReviewRequestAlreadySentForOrder,
} from "@/lib/services/sellerReviewRequest"
import { createServiceRoleClient } from "@/lib/supabase/server"

const PAGE_SIZE = 100

type FulfilledOrderRow = {
  id: string
  buyer_id: string
  seller_id: string
  listing_id: string | null
}

export type BackfillSellerReviewRequestsResult = {
  scanned: number
  alreadyReviewed: number
  sent: number
  alreadySent: number
  failed: number
  errors: Array<{ orderId: string; error: string }>
}

async function loadBuyerReviewedOrderIds(
  supabase: SupabaseClient,
  orders: FulfilledOrderRow[],
): Promise<Set<string>> {
  if (orders.length === 0) return new Set()

  const { data, error } = await supabase
    .from("reviews")
    .select("order_id, reviewer_id")
    .in(
      "order_id",
      orders.map((o) => o.id),
    )

  if (error) {
    throw new Error(`Could not load reviews: ${error.message}`)
  }

  const buyerByOrder = new Map(orders.map((o) => [o.id, o.buyer_id]))
  const reviewed = new Set<string>()
  for (const row of data ?? []) {
    if (!row.order_id || !row.reviewer_id) continue
    if (buyerByOrder.get(row.order_id) === row.reviewer_id) {
      reviewed.add(row.order_id)
    }
  }
  return reviewed
}

/**
 * Send the in-thread + Klaviyo `Review Requested` ask for every fulfilled marketplace
 * order whose buyer has not reviewed yet. Idempotent — already-sent threads are skipped.
 */
export async function backfillSellerReviewRequests(opts?: {
  dryRun?: boolean
  limit?: number
}): Promise<BackfillSellerReviewRequestsResult> {
  const dryRun = opts?.dryRun === true
  const limit = opts?.limit && opts.limit > 0 ? opts.limit : Number.POSITIVE_INFINITY

  const supabase = createServiceRoleClient()
  const result: BackfillSellerReviewRequestsResult = {
    scanned: 0,
    alreadyReviewed: 0,
    sent: 0,
    alreadySent: 0,
    failed: 0,
    errors: [],
  }

  let offset = 0

  for (;;) {
    const { data, error } = await supabase
      .from("orders")
      .select("id, buyer_id, seller_id, listing_id")
      .eq("status", "confirmed")
      .in("delivery_status", ["delivered", "picked_up"])
      .match(REAL_MARKETPLACE_SALES_FILTER)
      .not("buyer_id", "is", null)
      .not("seller_id", "is", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      throw new Error(`Could not load fulfilled orders: ${error.message}`)
    }

    const batch = (data ?? []) as FulfilledOrderRow[]
    if (batch.length === 0) break

    const alreadyReviewed = await loadBuyerReviewedOrderIds(supabase, batch)

    for (const order of batch) {
      if (result.sent + result.alreadySent + result.failed >= limit) {
        return result
      }

      result.scanned += 1

      if (alreadyReviewed.has(order.id)) {
        result.alreadyReviewed += 1
        continue
      }

      if (dryRun) {
        const alreadySent = await sellerReviewRequestAlreadySentForOrder(
          supabase,
          order.buyer_id,
          order.seller_id,
          order.id,
          order.listing_id,
        )
        if (alreadySent) {
          result.alreadySent += 1
        } else {
          result.sent += 1
        }
        continue
      }

      const send = await autoSendSellerReviewRequestForOrder(order.id)
      if (!send.ok) {
        result.failed += 1
        result.errors.push({ orderId: order.id, error: send.error })
        console.error(`[backfillSellerReviewRequests] fail ${order.id}: ${send.error}`)
        continue
      }
      if (send.alreadySent) {
        result.alreadySent += 1
      } else {
        result.sent += 1
        if (result.sent % 10 === 0) {
          console.log(`[backfillSellerReviewRequests] sent ${result.sent}…`)
        }
      }
    }

    if (batch.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return result
}
