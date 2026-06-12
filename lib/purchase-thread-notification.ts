import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateMessagesInboxForParticipants } from "@/lib/cache/revalidate-messages-inbox"
import { getConversationForBuyerSellerListing, ensureConversationForBuyerSellerListing } from "@/lib/db/conversations"
import { trackKlaviyoMessageSent } from "@/lib/klaviyo/track-message-sent"
import type { OrderPlacedMessagePayload } from "@/lib/validations/order-placed-message-metadata"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"

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
  return method === "reswell_bucks" ? "wallet" : "card"
}

function buildPurchaseThreadPlainText(params: {
  orderNum: string
  listingTitles: string[]
  total: number
  fulfillment: "pickup" | "shipping"
  shippingAddress: Record<string, unknown> | null
  paymentMethod: OrderPlacedMessagePayload["paymentMethod"]
}): string {
  const { orderNum, listingTitles, total, fulfillment, shippingAddress, paymentMethod } = params

  const header = `Order #${orderNum} — $${total.toFixed(2)} total`
  const cleanedTitles = listingTitles.map((t) => t.trim()).filter(Boolean)
  const itemBlock =
    cleanedTitles.length <= 1
      ? [`Item: "${cleanedTitles[0] ?? "Purchase"}"`]
      : ["Items:", ...cleanedTitles.map((t) => `• "${t}"`)]
  const payLine = `Paid with ${paymentPhrase(paymentMethod)}`

  const fulfillmentLine =
    fulfillment === "shipping"
      ? "Fulfillment: shipping — use your order/sale dashboard for tracking once shipped."
      : "Fulfillment: local pickup — reply in this thread to coordinate a pickup time."

  const shipBlock = fulfillment === "shipping" ? shippingLines(shippingAddress).join("\n") : ""

  return [header, "", ...itemBlock, payLine, "", fulfillmentLine, shipBlock].filter(Boolean).join("\n").trim()
}

export async function postPurchaseThreadNotification(
  supabase: SupabaseClient,
  params: {
    buyerId: string
    sellerId: string
    /** Conversation anchor listing (first line item). */
    primaryListingId: string
    listingIds: string[]
    listingTitles: string[]
    /** Short summary for structured metadata / compact UI (e.g. multi-item). */
    listingTitleSummary: string
    /** `orders.id` — used for dashboard links in the thread UI. */
    orderId: string
    /** `orders.order_num` (customer-facing reference). */
    orderNum: string
    total: number
    fulfillment: "pickup" | "shipping"
    shippingAddress: Record<string, unknown> | null
    paymentMethod: OrderPlacedMessagePayload["paymentMethod"]
  },
): Promise<void> {
  const {
    buyerId,
    sellerId,
    primaryListingId,
    listingIds,
    listingTitles,
    listingTitleSummary,
    orderId,
    orderNum,
    total,
    fulfillment,
    shippingAddress,
    paymentMethod,
  } = params

  let conversation = await getConversationForBuyerSellerListing(
    supabase,
    buyerId,
    sellerId,
    primaryListingId,
  )

  if (!conversation) {
    const ensured = await ensureConversationForBuyerSellerListing(
      supabase,
      buyerId,
      sellerId,
      primaryListingId,
    )
    if (!ensured) {
      console.error("[purchase notification] conversation insert failed")
      return
    }
    conversation = { id: ensured.id, listing_id: primaryListingId }
  }

  const content = buildPurchaseThreadPlainText({
    orderNum,
    listingTitles,
    total,
    fulfillment,
    shippingAddress,
    paymentMethod,
  })

  const metadata: OrderPlacedMessagePayload = {
    kind: "order_placed",
    orderId,
    orderNum,
    listingTitle: listingTitleSummary,
    ...(listingTitles.length > 1
      ? { listingTitles, listingIds }
      : {}),
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
    listingId: primaryListingId,
    messageId: inserted.id,
    sentAt: inserted.created_at,
  })

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversation.id)

  try {
    revalidateMessagesInboxForParticipants(buyerId, sellerId)
  } catch (revalidateErr) {
    console.error("[purchase notification] inbox revalidate (non-fatal):", revalidateErr)
  }
}

/**
 * Posts the purchase thread message for an existing order when checkout side effects were
 * interrupted (e.g. webhook disabled, finalize crashed after DB write). Skips if one already exists.
 */
export async function postPurchaseThreadNotificationForOrderId(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  const trimmedOrderId = orderId.trim()
  if (!trimmedOrderId) return

  const { data: existingMsg } = await supabase
    .from("messages")
    .select("id")
    .contains("metadata", { kind: "order_placed", orderId: trimmedOrderId })
    .maybeSingle()

  if (existingMsg?.id) return

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_num, buyer_id, seller_id, listing_id, amount, fulfillment_method, shipping_address, payment_method",
    )
    .eq("id", trimmedOrderId)
    .maybeSingle()

  if (!order?.buyer_id || !order.seller_id || !order.listing_id) return

  const { data: orderItems } = await supabase
    .from("order_items")
    .select("listing_id, sort_order")
    .eq("order_id", trimmedOrderId)
    .order("sort_order", { ascending: true })

  const listingIds =
    orderItems && orderItems.length > 0
      ? orderItems.map((row) => String((row as { listing_id: string }).listing_id))
      : [order.listing_id]

  const { data: listingRows } = await supabase.from("listings").select("id, title").in("id", listingIds)

  const listingMap = new Map(
    (listingRows ?? []).map((row) => {
      const r = row as { id: string; title: string | null }
      return [r.id, r]
    }),
  )

  const listingsOrdered = listingIds
    .map((id) => listingMap.get(id))
    .filter((row): row is { id: string; title: string | null } => row != null)

  if (listingsOrdered.length === 0) return

  const listingTitles = listingsOrdered.map((l) => String(l.title ?? ""))
  const primaryListingId = listingIds[0]!
  const rawAmount = order.amount as unknown
  const amount =
    typeof rawAmount === "number"
      ? rawAmount
      : parseFloat(typeof rawAmount === "string" ? rawAmount : String(rawAmount))

  await postPurchaseThreadNotification(supabase, {
    buyerId: order.buyer_id,
    sellerId: order.seller_id,
    primaryListingId,
    listingIds,
    listingTitles,
    listingTitleSummary:
      listingTitles.length === 1
        ? listingTitles[0]!
        : `${listingTitles.length} items — ${listingTitles.map((t) => `"${t}"`).join(", ")}`,
    orderId: order.id,
    orderNum: formatOrderNumForCustomer(
      (order as { order_num?: string | null }).order_num,
      order.id,
    ),
    total: Number.isFinite(amount) ? amount : 0,
    fulfillment: order.fulfillment_method === "pickup" ? "pickup" : "shipping",
    shippingAddress: (order.shipping_address as Record<string, unknown> | null) ?? null,
    paymentMethod: order.payment_method === "reswell_bucks" ? "reswell_bucks" : "card",
  })
}
