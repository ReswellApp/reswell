import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import {
  insertMarketplaceReviewForOrder,
  getMarketplaceReviewByOrderAndReviewer,
} from "@/lib/db/order-reviews"
import { trackKlaviyoSellerReviewedBuyer } from "@/lib/klaviyo/track-seller-reviewed-buyer"
import { validateSellerReviewForOrder } from "@/lib/services/orderSellerReview"
import { orderSellerReviewBodySchema } from "@/lib/validations/order-seller-review"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = orderSellerReviewBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 })
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, buyer_id, seller_id, listing_id, status, delivery_status")
    .eq("id", orderId)
    .maybeSingle()

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const isBuyer = order.buyer_id === user.id
  const isSeller = order.seller_id === user.id
  if (!isBuyer && !isSeller) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const gate = validateSellerReviewForOrder(order)
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: 400 })
  }

  const { data: existing } = await getMarketplaceReviewByOrderAndReviewer(supabase, orderId, user.id)
  if (existing) {
    return NextResponse.json({ error: "You already submitted a review for this order." }, { status: 409 })
  }

  if (!order.listing_id) {
    return NextResponse.json({ error: "This order has no listing to attach a review to." }, { status: 400 })
  }

  const reviewedId = isBuyer ? order.seller_id : order.buyer_id

  const { data, error } = await insertMarketplaceReviewForOrder(supabase, {
    order_id: orderId,
    reviewer_id: user.id,
    reviewed_id: reviewedId,
    listing_id: order.listing_id,
    rating: parsed.data.rating,
    comment: parsed.data.comment ?? null,
  })

  if (error || !data) {
    console.error("[order review] insert:", error)
    if (
      error?.message.includes("reviews_order_id_reviewer_uidx") ||
      error?.message.includes("reviews_order_id_uidx") ||
      error?.message.includes("duplicate key")
    ) {
      return NextResponse.json({ error: "You already submitted a review for this order." }, { status: 409 })
    }
    return NextResponse.json({ error: "Could not save your review" }, { status: 500 })
  }

  if (isSeller && order.buyer_id) {
    void trackKlaviyoSellerReviewedBuyer({
      orderId,
      buyerUserId: order.buyer_id,
      sellerUserId: user.id,
      listingId: order.listing_id,
      rating: parsed.data.rating,
      comment: parsed.data.comment ?? null,
    })
  }

  return NextResponse.json({ success: true, id: data.id, created_at: data.created_at })
}
