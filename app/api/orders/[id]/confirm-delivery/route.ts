import { createClient } from "@/lib/supabase/server"
import { getConversationForBuyerSellerListing, ensureConversationForBuyerSellerListing } from "@/lib/db/conversations"
import { notifyBuyerReviewEligibleKlaviyo } from "@/lib/services/notifyBuyerReviewEligibleKlaviyo"
import { NextRequest, NextResponse } from "next/server"

/**
 * Buyer marks the shipment received (manual-tracking orders only).
 * Reswell shipping with carrier tracking completes from ShipEngine delivery + 24h hold.
 */
export async function POST(
  _request: NextRequest,
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

  const { data: order, error: fetchErr } = await supabase
    .from("orders")
    .select("id, buyer_id, seller_id, delivery_status, fulfillment_method, listing_id")
    .eq("id", orderId)
    .eq("buyer_id", user.id)
    .single()

  if (fetchErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  if (order.fulfillment_method !== "shipping") {
    return NextResponse.json({ error: "Use pickup verification for local pickup orders" }, { status: 400 })
  }

  if (order.delivery_status !== "shipped") {
    return NextResponse.json(
      { error: "Order must be in 'shipped' status to confirm delivery" },
      { status: 409 },
    )
  }

  const now = new Date().toISOString()

  const { error: orderErr } = await supabase
    .from("orders")
    .update({ delivery_status: "delivered", updated_at: now })
    .eq("id", orderId)

  if (orderErr) {
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
  }

  await supabase
    .from("payouts")
    .update({
      hold_reason: "awaiting_manual_release",
      updated_at: now,
    })
    .eq("order_id", orderId)
    .eq("status", "held")

  const { data: listing } = await supabase
    .from("listings")
    .select("title")
    .eq("id", order.listing_id)
    .maybeSingle()

  let conv = await getConversationForBuyerSellerListing(
    supabase,
    user.id,
    order.seller_id,
    order.listing_id,
  )

  if (!conv) {
    const ensured = await ensureConversationForBuyerSellerListing(
      supabase,
      user.id,
      order.seller_id,
      order.listing_id,
    )
    if (ensured) {
      conv = { id: ensured.id, listing_id: order.listing_id }
    }
  }

  if (conv) {
    await supabase.from("messages").insert({
      conversation_id: conv.id,
      sender_id: user.id,
      content: `I confirmed I received "${listing?.title ?? "the item"}". Reswell will review and an admin can approve your payout after verifying delivery.`,
    })
    await supabase
      .from("conversations")
      .update({ last_message_at: now })
      .eq("id", conv.id)
  }

  void notifyBuyerReviewEligibleKlaviyo(supabase, orderId, "buyer_confirmed_delivery")

  return NextResponse.json({ success: true })
}
