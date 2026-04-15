import type { SupabaseClient } from "@supabase/supabase-js"
import { getConversationForBuyerSeller } from "@/lib/db/conversations"
import { trackKlaviyoMessageSent } from "@/lib/klaviyo/track-message-sent"
import type { OrderPlacedMessagePayload } from "@/lib/validations/order-placed-message-metadata"

function shippingLines(shipping: Record<string, unknown> | null): string[] {
  if (!shipping) return []
  const name = typeof shipping.name === "string" ? shipping.name.trim() : ""
  const phone = typeof shipping.phone === "string" ? shipping.phone.trim() : ""
  const email = typeof shipping.email === "string" ? shipping.email.trim() : ""
  const rawAddr = shipping.address
  const addr =
    rawAddr && typeof rawAddr === "object" && !Array.isArray(rawAddr)
      ? (rawAddr as Record<string, string | null | undefined>)
      : null

  const lines: string[] = ["", "Ship to:"]
  if (name) lines.push(name)
  if (addr?.line1?.trim()) lines.push(addr.line1.trim())
  if (addr?.line2?.trim()) lines.push(addr.line2.trim())
  const cityState = [addr?.city, addr?.state, addr?.postal_code].filter(Boolean).join(", ").trim()
  if (cityState) lines.push(cityState)
  if (addr?.country?.trim()) lines.push(addr.country.trim().toUpperCase())
  if (phone) lines.push(`Phone: ${phone}`)
  if (email) lines.push(`Email: ${email}`)
  return lines
}

/**
 * Opens or reuses the listing thread and posts a buyer message with payment + fulfillment details
 * so the seller sees the order in Messages without emailing infrastructure.
 */
function paymentPhrase(method: OrderPlacedMessagePayload["paymentMethod"]): string {
  return method === "reswell_bucks" ? "Reswell Bucks" : "card"
}

function buildPurchaseThreadPlainText(params: {
  orderNum: string
  listingTitle: string
  total: number
  fulfillment: "pickup" | "shipping"
  shippingAddress: Record<string, unknown> | null
  paymentMethod: OrderPlacedMessagePayload["paymentMethod"]
}): string {
  const { orderNum, listingTitle, total, fulfillment, shippingAddress, paymentMethod } = params

  const header = `Order #${orderNum} — $${total.toFixed(2)} total`
  const itemLine = `Item: "${listingTitle}"`
  const payLine = `Paid with ${paymentPhrase(paymentMethod)}`

  const fulfillmentLine =
    fulfillment === "shipping"
      ? "Fulfillment: shipping — use your order/sale dashboard for tracking once shipped."
      : "Fulfillment: local pickup — reply in this thread to coordinate a pickup time."

  const shipBlock = fulfillment === "shipping" ? shippingLines(shippingAddress).join("\n") : ""

  return [header, "", itemLine, payLine, "", fulfillmentLine, shipBlock].filter(Boolean).join("\n").trim()
}

export async function postPurchaseThreadNotification(
  supabase: SupabaseClient,
  params: {
    buyerId: string
    sellerId: string
    listingId: string
    listingTitle: string
    /** `orders.id` — used for dashboard links in the thread UI. */
    orderId: string
    /** `orders.order_num` (customer-facing reference). */
    orderNum: string
    total: number
    fulfillment: "pickup" | "shipping"
    shippingAddress: Record<string, unknown> | null
    paymentMethod: OrderPlacedMessagePayload["paymentMethod"]
  }
): Promise<void> {
  const {
    buyerId,
    sellerId,
    listingId,
    listingTitle,
    orderId,
    orderNum,
    total,
    fulfillment,
    shippingAddress,
    paymentMethod,
  } = params

  let conversation = await getConversationForBuyerSeller(supabase, buyerId, sellerId)

  if (!conversation) {
    const { data: created, error: convError } = await supabase
      .from("conversations")
      .insert({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: listingId,
      })
      .select("id")
      .single()

    if (convError || !created) {
      console.error("[purchase notification] conversation insert failed:", convError)
      return
    }
    conversation = { id: created.id, listing_id: listingId }
  } else {
    await supabase.from("conversations").update({ listing_id: listingId }).eq("id", conversation.id)
  }

  const content = buildPurchaseThreadPlainText({
    orderNum,
    listingTitle,
    total,
    fulfillment,
    shippingAddress,
    paymentMethod,
  })

  const metadata: OrderPlacedMessagePayload = {
    kind: "order_placed",
    orderId,
    orderNum,
    listingTitle,
    total,
    fulfillment,
    paymentMethod,
  }

  const { data: inserted, error: msgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      sender_id: buyerId,
      content,
      metadata,
    })
    .select("id, created_at")
    .single()

  if (msgError || !inserted) {
    console.error("[purchase notification] message insert failed:", msgError)
    return
  }

  void trackKlaviyoMessageSent({
    senderUserId: buyerId,
    receiverUserId: sellerId,
    message: content,
    conversationId: conversation.id,
    listingId,
    messageId: inserted.id,
    sentAt: inserted.created_at,
  })

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversation.id)
}
