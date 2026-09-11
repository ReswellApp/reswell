import type { SupabaseClient } from "@supabase/supabase-js"
import { getMarketplaceReviewByOrderAndReviewer } from "@/lib/db/order-reviews"
import { trackKlaviyoReviewBuyerRequested } from "@/lib/klaviyo/track-review-buyer-requested"
import { capitalizeWords } from "@/lib/listing-labels"
import { REAL_MARKETPLACE_SALES_FILTER } from "@/lib/order-admin-test"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { validateSellerReviewForOrder } from "@/lib/services/orderSellerReview"
import { parseOrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import { createServiceRoleClient } from "@/lib/supabase/server"

type OrderListingRow = { id: string; title: string | null }

function unwrapListing<R>(raw: R | R[] | null | undefined): R | null {
  if (raw == null) return null
  return Array.isArray(raw) ? raw[0] ?? null : raw
}

function displayListingTitleSummary(order: {
  listings: OrderListingRow | OrderListingRow[] | null
  order_items?: Array<{ sort_order: number | null; listings: OrderListingRow | OrderListingRow[] | null }> | null
}): string {
  const sortedPack = [...(order.order_items ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )
  const linesFromPack: OrderListingRow[] = []
  for (const it of sortedPack) {
    const L = unwrapListing(it.listings)
    if (L) linesFromPack.push(L)
  }
  const fallback = unwrapListing(order.listings)
  const displayListings = linesFromPack.length > 0 ? linesFromPack : fallback ? [fallback] : []
  if (displayListings.length === 0) return "Your sale"
  if (displayListings.length > 1) {
    return displayListings.map((l) => capitalizeWords(l.title ?? "")).filter(Boolean).join(" · ")
  }
  return capitalizeWords(displayListings[0]?.title ?? "") || "Your sale"
}

type OrderRowForBuyerReviewPrompt = {
  id: string
  order_num: string | null
  buyer_id: string
  seller_id: string
  listing_id: string | null
  status: string
  delivery_status: string
  tracking_detail?: unknown
  is_admin_test?: boolean | null
  listings: OrderListingRow | OrderListingRow[] | null
  order_items?: Array<{ sort_order: number | null; listings: OrderListingRow | OrderListingRow[] | null }> | null
}

export type AutoSendReviewBuyerRequestedResult =
  | { ok: true; alreadySent: boolean }
  | { ok: false; error: string }

/**
 * Email the seller to review the buyer after delivery/pickup.
 * Klaviyo unique_id is per order — safe to call again.
 */
export async function autoSendReviewBuyerRequestedForOrder(
  orderId: string,
): Promise<AutoSendReviewBuyerRequestedResult> {
  let supabase: SupabaseClient
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    console.error("[review buyer requested] service role:", e)
    return { ok: false, error: "Could not send the seller review prompt." }
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      buyer_id,
      seller_id,
      listing_id,
      status,
      delivery_status,
      tracking_detail,
      is_admin_test,
      listings ( id, title ),
      order_items (
        sort_order,
        listings ( id, title )
      )
    `,
    )
    .eq("id", orderId)
    .maybeSingle()

  if (orderErr || !order) {
    return { ok: false, error: "Order not found." }
  }

  const row = order as unknown as OrderRowForBuyerReviewPrompt
  if (row.is_admin_test === true) {
    return { ok: true, alreadySent: false }
  }
  if (!row.buyer_id || !row.seller_id) {
    return { ok: false, error: "Order is missing a buyer or seller." }
  }

  const trackingDetail = parseOrderTrackingDetail(row.tracking_detail)
  const gate = validateSellerReviewForOrder(
    {
      status: row.status,
      delivery_status: row.delivery_status,
    },
    trackingDetail,
  )
  if (!gate.ok) {
    return { ok: false, error: gate.error }
  }

  const { data: existingReview, error: revErr } = await getMarketplaceReviewByOrderAndReviewer(
    supabase,
    row.id,
    row.seller_id,
  )
  if (revErr) {
    return { ok: false, error: "Could not check existing reviews." }
  }
  if (existingReview) {
    return { ok: true, alreadySent: true }
  }

  try {
    await trackKlaviyoReviewBuyerRequested({
      orderId: row.id,
      orderNum: formatOrderNumForCustomer(row.order_num, row.id),
      listingId: row.listing_id,
      listingTitle: displayListingTitleSummary(row),
      sellerUserId: row.seller_id,
      buyerUserId: row.buyer_id,
    })
  } catch (e) {
    console.error("[review buyer requested] klaviyo:", e)
    return { ok: false, error: "Could not send the seller review prompt." }
  }

  return { ok: true, alreadySent: false }
}

export type BackfillReviewBuyerRequestedResult = {
  scanned: number
  alreadyReviewed: number
  sent: number
  failed: number
  errors: Array<{ orderId: string; error: string }>
}

const PAGE_SIZE = 100

/**
 * Fire `Review Buyer Requested` for fulfilled marketplace sales whose seller
 * has not reviewed the buyer yet. Idempotent via Klaviyo unique_id.
 */
export async function backfillReviewBuyerRequested(opts?: {
  dryRun?: boolean
}): Promise<BackfillReviewBuyerRequestedResult> {
  const dryRun = opts?.dryRun === true
  const supabase = createServiceRoleClient()
  const result: BackfillReviewBuyerRequestedResult = {
    scanned: 0,
    alreadyReviewed: 0,
    sent: 0,
    failed: 0,
    errors: [],
  }

  let offset = 0

  for (;;) {
    const { data, error } = await supabase
      .from("orders")
      .select("id, seller_id")
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

    const batch = (data ?? []) as Array<{ id: string; seller_id: string }>
    if (batch.length === 0) break

    const { data: reviews, error: reviewsErr } = await supabase
      .from("reviews")
      .select("order_id, reviewer_id")
      .in(
        "order_id",
        batch.map((o) => o.id),
      )

    if (reviewsErr) {
      throw new Error(`Could not load reviews: ${reviewsErr.message}`)
    }

    const sellerByOrder = new Map(batch.map((o) => [o.id, o.seller_id]))
    const sellerAlreadyReviewed = new Set<string>()
    for (const row of reviews ?? []) {
      if (!row.order_id || !row.reviewer_id) continue
      if (sellerByOrder.get(row.order_id) === row.reviewer_id) {
        sellerAlreadyReviewed.add(row.order_id)
      }
    }

    for (const order of batch) {
      result.scanned += 1
      if (sellerAlreadyReviewed.has(order.id)) {
        result.alreadyReviewed += 1
        continue
      }

      if (dryRun) {
        result.sent += 1
        continue
      }

      const send = await autoSendReviewBuyerRequestedForOrder(order.id)
      if (!send.ok) {
        result.failed += 1
        result.errors.push({ orderId: order.id, error: send.error })
        console.error(`[backfillReviewBuyerRequested] fail ${order.id}: ${send.error}`)
        continue
      }
      if (send.alreadySent) {
        result.alreadyReviewed += 1
      } else {
        result.sent += 1
        if (result.sent % 10 === 0) {
          console.log(`[backfillReviewBuyerRequested] sent ${result.sent}…`)
        }
      }
    }

    if (batch.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return result
}
