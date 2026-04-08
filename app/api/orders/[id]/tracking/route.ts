import { createClient } from "@/lib/supabase/server"
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

  const { error: updateErr } = await supabase
    .from("orders")
    .update({
      tracking_number: trackingNumber,
      tracking_carrier: body.tracking_carrier?.trim() || null,
      delivery_status: "shipped",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)

  if (updateErr) {
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
  }

  await supabase
    .from("payouts")
    .update({
      hold_reason: "awaiting_delivery",
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", orderId)

  const { data: listing } = await supabase
    .from("listings")
    .select("title")
    .eq("id", order.listing_id)
    .maybeSingle()

  const title = listing?.title ?? "your item"
  const carrier = body.tracking_carrier?.trim()
  const msgContent = [
    `Tracking added for "${title}":`,
    carrier ? `Carrier: ${carrier}` : null,
    `Tracking #: ${trackingNumber}`,
    "",
    "You'll be asked to confirm delivery once it arrives.",
  ]
    .filter((l) => l !== null)
    .join("\n")

  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("buyer_id", order.buyer_id)
    .eq("seller_id", user.id)
    .eq("listing_id", order.listing_id)
    .maybeSingle()

  if (conv) {
    await supabase.from("messages").insert({
      conversation_id: conv.id,
      sender_id: user.id,
      content: msgContent,
    })
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conv.id)
  }

  return NextResponse.json({ success: true })
}
