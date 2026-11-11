import {
  mobileOrderReviewResultSchema,
  type MobileOrderReviewBody,
  type MobileOrderReviewResult,
} from "@reswell/api-contract"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import { marketplaceOrderParticipantRole } from "@/lib/account-access/order-operator"
import {
  loadOrderForMarketplaceReview,
  submitMarketplaceOrderReview,
} from "@/lib/services/submitMarketplaceOrderReview"
import type { SupabaseClient } from "@supabase/supabase-js"

export async function submitMobileOrderReviewService(
  supabase: SupabaseClient,
  userId: string,
  orderId: string,
  body: MobileOrderReviewBody,
): Promise<MobileApiResult<MobileOrderReviewResult>> {
  const order = await loadOrderForMarketplaceReview(supabase, orderId)
  if (!order) return { ok: false, status: 404, error: "Order not found" }

  const role = marketplaceOrderParticipantRole({
    buyerId: order.buyer_id,
    sellerId: order.seller_id,
    actorUserId: userId,
    operatingSellerId: userId,
    canWriteOrders: true,
  })
  if (!role) return { ok: false, status: 404, error: "Order not found" }

  const result = await submitMarketplaceOrderReview(supabase, {
    actorUserId: userId,
    role,
    order,
    body,
  })
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error }
  }

  const parsed = mobileOrderReviewResultSchema.safeParse({
    id: result.id,
    created_at: result.created_at,
  })
  if (!parsed.success) return { ok: false, status: 500, error: "Could not save your review" }
  return { ok: true, data: parsed.data }
}
