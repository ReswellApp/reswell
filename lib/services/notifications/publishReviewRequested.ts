import type { SupabaseClient } from "@supabase/supabase-js"
import { purchaseHrefForOrderId, saleHrefForOrderId } from "@/lib/earnings-sale-ledger"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import {
  reviewBuyerRequestedBody,
  reviewBuyerRequestedDedupeKey,
  reviewBuyerRequestedTitle,
  reviewSellerRequestedBody,
  reviewSellerRequestedDedupeKey,
  reviewSellerRequestedTitle,
} from "@/lib/services/notifications/catalog"
import { publishInAppNotifications } from "@/lib/services/notifications/publish"
import type { InAppNotificationInput } from "@/lib/services/notifications/plan"
import { createServiceRoleClient } from "@/lib/supabase/server"

const CLOSED_ORDER_STATUSES = new Set(["refunded", "refunding", "cancelled", "canceled", "failed"])

/**
 * After delivery or pickup, ask the buyer to rate the seller and the seller to
 * rate the buyer. One in-app + push row per side, skipped if that side already reviewed.
 */
export async function publishReviewRequestedNotifications(orderId: string): Promise<void> {
  const trimmed = orderId.trim()
  if (!trimmed) return

  let supabase: SupabaseClient
  try {
    supabase = createServiceRoleClient()
  } catch (error) {
    console.error(
      "[notifications] review requested service role:",
      error instanceof Error ? error.message : error,
    )
    return
  }

  try {
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_num, buyer_id, seller_id, listing_id, status, is_admin_test")
      .eq("id", trimmed)
      .maybeSingle()

    if (error || !data) {
      if (error) console.error("[notifications] review requested load:", error.message)
      return
    }

    const order = data as {
      id: string
      order_num: string | null
      buyer_id: string | null
      seller_id: string | null
      listing_id: string | null
      status: string | null
      is_admin_test: boolean | null
    }

    if (order.is_admin_test === true) return
    const status = (order.status ?? "").trim().toLowerCase()
    if (CLOSED_ORDER_STATUSES.has(status)) return

    const buyerId = order.buyer_id?.trim() || ""
    const sellerId = order.seller_id?.trim() || ""
    if (!buyerId && !sellerId) return

    const [{ data: reviews }, { data: profiles }] = await Promise.all([
      supabase.from("reviews").select("reviewer_id").eq("order_id", order.id),
      supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", [buyerId, sellerId].filter(Boolean)),
    ])

    const reviewedBy = new Set(
      (reviews ?? [])
        .map((row) => (typeof row.reviewer_id === "string" ? row.reviewer_id : ""))
        .filter(Boolean),
    )
    const nameById = new Map<string, string>()
    for (const row of profiles ?? []) {
      const name = typeof row.display_name === "string" ? row.display_name.trim() : ""
      if (typeof row.id === "string" && name) nameById.set(row.id, name)
    }

    const orderNum = formatOrderNumForCustomer(order.order_num, order.id)
    const listingId = order.listing_id?.trim() || null
    const sellerName = nameById.get(sellerId) || "the seller"
    const buyerName = nameById.get(buyerId) || "the buyer"
    const inputs: InAppNotificationInput[] = []

    if (buyerId && !reviewedBy.has(buyerId)) {
      inputs.push({
        userId: buyerId,
        type: "review_seller_requested",
        listingId,
        title: reviewSellerRequestedTitle(),
        body: reviewSellerRequestedBody(orderNum, sellerName),
        href: purchaseHrefForOrderId(order.id),
        dedupeKey: reviewSellerRequestedDedupeKey(order.id),
        metadata: { orderId: order.id, orderNum, subject: "seller" },
      })
    }

    if (sellerId && sellerId !== buyerId && !reviewedBy.has(sellerId)) {
      inputs.push({
        userId: sellerId,
        type: "review_buyer_requested",
        listingId,
        title: reviewBuyerRequestedTitle(),
        body: reviewBuyerRequestedBody(orderNum, buyerName),
        href: saleHrefForOrderId(order.id),
        dedupeKey: reviewBuyerRequestedDedupeKey(order.id),
        metadata: { orderId: order.id, orderNum, subject: "buyer" },
      })
    }

    if (inputs.length === 0) return
    await publishInAppNotifications(supabase, inputs)
  } catch (error) {
    console.error(
      "[notifications] review requested:",
      error instanceof Error ? error.message : error,
    )
  }
}
