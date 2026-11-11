import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateListYourSurfboardShowcase } from "@/lib/cache/revalidate-list-your-surfboard-showcase"
import { revalidateSellerProfileAndDirectoryCatalog } from "@/lib/cache/revalidate-sellers-directory-catalog"
import {
  getMarketplaceReviewByOrderAndReviewer,
  insertMarketplaceReviewForOrder,
} from "@/lib/db/order-reviews"
import { trackKlaviyoSellerReviewedBuyer } from "@/lib/klaviyo/track-seller-reviewed-buyer"
import { evaluateUserReview } from "@/lib/services/accountRestrictions"
import { resolveMarketplaceReviewAttachmentMetadata } from "@/lib/services/marketplaceReviewAttachments"
import { validateSellerReviewForOrder } from "@/lib/services/orderSellerReview"
import { parseOrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type { OrderSellerReviewBody } from "@/lib/validations/order-seller-review"

export type SubmitMarketplaceOrderReviewResult =
  | { ok: true; id: string; created_at: string }
  | {
      ok: false
      status: number
      error: string
      code?: string
      restrictedUntil?: string
    }

type OrderRow = {
  id: string
  buyer_id: string | null
  seller_id: string | null
  listing_id: string | null
  status: string
  delivery_status: string | null
  tracking_detail: unknown
}

/**
 * Same marketplace order review write the website `/api/orders/[id]/review` uses.
 * Buyer rates the seller; seller rates the buyer. One review per reviewer per order.
 */
export async function submitMarketplaceOrderReview(
  supabase: SupabaseClient,
  input: {
    actorUserId: string
    role: "buyer" | "seller"
    order: OrderRow
    body: OrderSellerReviewBody
  },
): Promise<SubmitMarketplaceOrderReviewResult> {
  const reviewGuard = await evaluateUserReview(supabase, input.actorUserId)
  if (!reviewGuard.ok) {
    return {
      ok: false,
      status: 403,
      error: reviewGuard.userMessage,
      code: reviewGuard.error,
      restrictedUntil: reviewGuard.restrictedUntil,
    }
  }

  const trackingDetail = parseOrderTrackingDetail(input.order.tracking_detail)
  const gate = validateSellerReviewForOrder(
    {
      status: input.order.status,
      delivery_status: input.order.delivery_status ?? "pending",
    },
    trackingDetail,
  )
  if (!gate.ok) {
    return { ok: false, status: 400, error: gate.error }
  }

  const reviewerId =
    input.role === "seller" ? String(input.order.seller_id ?? "") : input.actorUserId
  if (!reviewerId) {
    return { ok: false, status: 404, error: "Order not found" }
  }

  const { data: existing } = await getMarketplaceReviewByOrderAndReviewer(
    supabase,
    input.order.id,
    reviewerId,
  )
  if (existing) {
    return { ok: false, status: 409, error: "You already submitted a review for this order." }
  }

  if (!input.order.listing_id) {
    return { ok: false, status: 400, error: "This order has no listing to attach a review to." }
  }

  const reviewedId = input.role === "buyer" ? input.order.seller_id : input.order.buyer_id
  if (!reviewedId) {
    return { ok: false, status: 404, error: "Order not found" }
  }

  const attachmentMeta = await resolveMarketplaceReviewAttachmentMetadata(
    input.actorUserId,
    input.body.attachments,
  )
  if (!attachmentMeta.ok) {
    return { ok: false, status: 400, error: attachmentMeta.error }
  }

  let reviewClient: SupabaseClient = supabase
  if (reviewerId !== input.actorUserId) {
    try {
      reviewClient = createServiceRoleClient()
    } catch {
      return { ok: false, status: 503, error: "Could not save your review" }
    }
  }

  const { data, error } = await insertMarketplaceReviewForOrder(reviewClient, {
    order_id: input.order.id,
    reviewer_id: reviewerId,
    reviewed_id: reviewedId,
    listing_id: input.order.listing_id,
    rating: input.body.rating,
    comment: input.body.comment ?? null,
    metadata: attachmentMeta.metadata,
  })

  if (error || !data) {
    console.error("[order review] insert:", error)
    if (
      error?.message.includes("reviews_order_id_reviewer_uidx") ||
      error?.message.includes("reviews_order_id_uidx") ||
      error?.message.includes("duplicate key")
    ) {
      return { ok: false, status: 409, error: "You already submitted a review for this order." }
    }
    return { ok: false, status: 500, error: "Could not save your review" }
  }

  if (input.role === "seller" && input.order.buyer_id) {
    void trackKlaviyoSellerReviewedBuyer({
      orderId: input.order.id,
      buyerUserId: input.order.buyer_id,
      sellerUserId: input.order.seller_id,
      listingId: input.order.listing_id,
      rating: input.body.rating,
      comment: input.body.comment ?? null,
    })
  }

  if (input.role === "buyer" && input.order.seller_id) {
    await revalidateSellerProfileAndDirectoryCatalog(supabase, input.order.seller_id)
  }
  revalidateListYourSurfboardShowcase()

  return { ok: true, id: data.id, created_at: data.created_at }
}

export async function loadOrderForMarketplaceReview(
  supabase: SupabaseClient,
  orderId: string,
): Promise<OrderRow | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, buyer_id, seller_id, listing_id, status, delivery_status, tracking_detail")
    .eq("id", orderId)
    .maybeSingle()

  if (error || !data) return null
  return data as OrderRow
}
