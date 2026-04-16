import { createClient } from "@/lib/supabase/server"
import { getConversationForBuyerSeller } from "@/lib/db/conversations"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { verifyOrderPickupForSeller } from "@/lib/services/orderPickupVerification"
import type { OrderCompletedMessagePayload } from "@/lib/validations/order-completed-message-metadata"
import { NextRequest, NextResponse } from "next/server"

function buildPickupCompleteThreadPlainText(params: {
  orderNum: string
  listingTitle: string
}): string {
  const header = `Order #${params.orderNum} — pickup complete`
  const itemLine = `Item: "${params.listingTitle}"`
  const tail = "Pickup confirmed. View your order or sale dashboard anytime for details."
  return [header, "", itemLine, "", tail].join("\n")
}

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

  const [{ data: listing }, { data: orderRow }] = await Promise.all([
    supabase.from("listings").select("title").eq("id", result.listingId).maybeSingle(),
    supabase.from("orders").select("order_num").eq("id", orderId).maybeSingle(),
  ])

  const listingTitle = listing?.title ?? "the item"
  const orderNum = formatOrderNumForCustomer(
    (orderRow as { order_num?: string | null } | null)?.order_num ?? null,
    orderId,
  )

  const metadata: OrderCompletedMessagePayload = {
    kind: "order_completed",
    orderId,
    orderNum,
    listingTitle,
  }

  const conv = await getConversationForBuyerSeller(supabase, result.buyerId, user.id)

  if (conv) {
    await supabase.from("messages").insert({
      conversation_id: conv.id,
      sender_id: user.id,
      content: buildPickupCompleteThreadPlainText({ orderNum, listingTitle }),
      metadata,
    })
    await supabase
      .from("conversations")
      .update({ last_message_at: now, listing_id: result.listingId })
      .eq("id", conv.id)
  }

  return NextResponse.json({ success: true })
}
