import { createClient } from "@/lib/supabase/server"
import { getConversationForBuyerSeller } from "@/lib/db/conversations"
import { verifyOrderPickupForSeller } from "@/lib/services/orderPickupVerification"
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

  const result = await verifyOrderPickupForSeller(supabase, { orderId, code })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const now = new Date().toISOString()

  const { data: listing } = await supabase
    .from("listings")
    .select("title")
    .eq("id", result.listingId)
    .maybeSingle()

  const conv = await getConversationForBuyerSeller(supabase, result.buyerId, user.id)

  if (conv) {
    await supabase.from("messages").insert({
      conversation_id: conv.id,
      sender_id: user.id,
      content: `Pickup confirmed for "${listing?.title ?? "the item"}". Payout is now available.`,
    })
    await supabase
      .from("conversations")
      .update({ last_message_at: now, listing_id: result.listingId })
      .eq("id", conv.id)
  }

  return NextResponse.json({ success: true })
}
