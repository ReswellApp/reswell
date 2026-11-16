import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { loadMarketplaceOrderAccess } from "@/lib/account-access/order-operator-session"
<<<<<<< HEAD
import {
  loadOrderForMarketplaceReview,
  submitMarketplaceOrderReview,
} from "@/lib/services/submitMarketplaceOrderReview"
import { orderSellerReviewBodySchema } from "@/lib/validations/order-seller-review"
=======
import { SITE_CLOSED } from "@/lib/site-closure"
>>>>>>> closing-down-

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

  const access = await loadMarketplaceOrderAccess(supabase, orderId)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const order = await loadOrderForMarketplaceReview(supabase, orderId)
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

<<<<<<< HEAD
  const result = await submitMarketplaceOrderReview(supabase, {
    actorUserId: user.id,
    role: access.role,
    order,
    body: parsed.data,
=======
  const isBuyer = access.role === "buyer"
  const isSeller = access.role === "seller"

  if (SITE_CLOSED && isSeller) {
    return NextResponse.json(
      { error: "Reswell has closed. New buyer reviews are no longer accepted." },
      { status: 403 },
    )
  }

  const trackingDetail = parseOrderTrackingDetail(order.tracking_detail)
  const gate = validateSellerReviewForOrder(order, trackingDetail)
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: 400 })
  }

  const reviewerId = isSeller ? String(order.seller_id ?? "") : user.id
  if (!reviewerId) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const { data: existing } = await getMarketplaceReviewByOrderAndReviewer(supabase, orderId, reviewerId)
  if (existing) {
    return NextResponse.json({ error: "You already submitted a review for this order." }, { status: 409 })
  }

  if (!order.listing_id) {
    return NextResponse.json({ error: "This order has no listing to attach a review to." }, { status: 400 })
  }

  const reviewedId = isBuyer ? order.seller_id : order.buyer_id

  const attachmentMeta = await resolveMarketplaceReviewAttachmentMetadata(
    user.id,
    parsed.data.attachments,
  )
  if (!attachmentMeta.ok) {
    return NextResponse.json({ error: attachmentMeta.error }, { status: 400 })
  }

  let reviewClient: SupabaseClient = supabase
  if (reviewerId !== user.id) {
    try {
      reviewClient = createServiceRoleClient()
    } catch {
      return NextResponse.json({ error: "Could not save your review" }, { status: 503 })
    }
  }

  const { data, error } = await insertMarketplaceReviewForOrder(reviewClient, {
    order_id: orderId,
    reviewer_id: reviewerId,
    reviewed_id: reviewedId,
    listing_id: order.listing_id,
    rating: parsed.data.rating,
    comment: parsed.data.comment ?? null,
    metadata: attachmentMeta.metadata,
>>>>>>> closing-down-
  })

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        ...(result.code ? { code: result.code } : {}),
        ...(result.restrictedUntil ? { restrictedUntil: result.restrictedUntil } : {}),
      },
      { status: result.status },
    )
  }

  return NextResponse.json({ success: true, id: result.id, created_at: result.created_at })
}
