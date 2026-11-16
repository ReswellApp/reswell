import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { loadMarketplaceOrderAccess } from "@/lib/account-access/order-operator-session"
import {
  loadOrderForMarketplaceReview,
  submitMarketplaceOrderReview,
} from "@/lib/services/submitMarketplaceOrderReview"
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

  const access = await loadMarketplaceOrderAccess(supabase, orderId)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const order = await loadOrderForMarketplaceReview(supabase, orderId)
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const result = await submitMarketplaceOrderReview(supabase, {
    actorUserId: user.id,
    role: access.role,
    order,
    body: parsed.data,
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
