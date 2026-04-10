import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { markOrderShippedWithTracking } from "@/lib/services/markOrderShipped"

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

  const body = (await request.json()) as {
    tracking_number?: string
    tracking_carrier?: string
  }

  const trackingNumber = body.tracking_number?.trim()
  if (!trackingNumber) {
    return NextResponse.json({ error: "Tracking number is required" }, { status: 400 })
  }

  const { data: order, error: fetchErr } = await supabase
    .from("orders")
    .select("id, seller_id, buyer_id, fulfillment_method, delivery_status, listing_id")
    .eq("id", orderId)
    .eq("seller_id", user.id)
    .single()

  if (fetchErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  if (order.fulfillment_method !== "shipping") {
    return NextResponse.json({ error: "Tracking only applies to shipped orders" }, { status: 400 })
  }

  if (order.delivery_status !== "pending") {
    return NextResponse.json({ error: "Tracking already added or order already delivered" }, { status: 409 })
  }

  const carrier = body.tracking_carrier?.trim() || null
  const result = await markOrderShippedWithTracking(
    supabase,
    { id: order.id, buyer_id: order.buyer_id, listing_id: order.listing_id },
    user.id,
    trackingNumber,
    carrier,
  )

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true })
}
