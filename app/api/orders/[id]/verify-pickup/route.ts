import { createClient } from "@/lib/supabase/server"
import { getConversationForBuyerSeller } from "@/lib/db/conversations"
import { releaseOrderSellerEarningsAfterFulfillment } from "@/lib/services/releaseOrderSellerEarnings"
import { NextRequest, NextResponse } from "next/server"

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

  const body = (await request.json()) as { code?: string }
  const code = body.code?.trim()

  if (!code) {
    return NextResponse.json({ error: "Pickup code is required" }, { status: 400 })
  }

  const { data: order, error: fetchErr } = await supabase
    .from("orders")
    .select("id, seller_id, buyer_id, fulfillment_method, delivery_status, pickup_code, listing_id")
    .eq("id", orderId)
    .eq("seller_id", user.id)
    .single()

  if (fetchErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  if (order.fulfillment_method !== "pickup") {
    return NextResponse.json({ error: "This order is not a pickup order" }, { status: 400 })
  }

  if (order.delivery_status === "picked_up") {
    return NextResponse.json({ error: "Pickup already confirmed" }, { status: 409 })
  }

  if (order.pickup_code !== code) {
    return NextResponse.json({ error: "Invalid pickup code" }, { status: 403 })
  }

  const now = new Date().toISOString()

  const { error: updateErr } = await supabase
    .from("orders")
    .update({ delivery_status: "picked_up", updated_at: now })
    .eq("id", orderId)

  if (updateErr) {
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
  }

  await supabase
    .from("payouts")
    .update({
      status: "pending",
      hold_reason: null,
      released_at: now,
      updated_at: now,
    })
    .eq("order_id", orderId)
    .eq("status", "held")

  const release = await releaseOrderSellerEarningsAfterFulfillment(orderId)
  if (!release.ok) {
    console.error("[verify-pickup] release seller earnings:", release.error)
    return NextResponse.json({ error: release.error }, { status: 500 })
  }

  const { data: listing } = await supabase
    .from("listings")
    .select("title")
    .eq("id", order.listing_id)
    .maybeSingle()

  const conv = await getConversationForBuyerSeller(supabase, order.buyer_id, user.id)

  if (conv) {
    await supabase.from("messages").insert({
      conversation_id: conv.id,
      sender_id: user.id,
      content: `Pickup confirmed for "${listing?.title ?? "the item"}". Payout is now available.`,
    })
    await supabase
      .from("conversations")
      .update({ last_message_at: now, listing_id: order.listing_id })
      .eq("id", conv.id)
  }

  return NextResponse.json({ success: true })
}
