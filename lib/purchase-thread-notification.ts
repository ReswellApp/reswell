import type { SupabaseClient } from "@supabase/supabase-js"
import { getConversationForBuyerSellerListing, ensureConversationForBuyerSellerListing } from "@/lib/db/conversations"
import type { OrderPlacedMessagePayload } from "@/lib/validations/order-placed-message-metadata"

function shippingLines(shipping: Record<string, unknown> | null): string[] {
  if (!shipping) return []
  const name = typeof shipping.name === "string" ? shipping.name.trim() : ""
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
  return lines
}

/**
 * Opens or reuses the listing thread and posts a buyer message with payment + fulfillment details
 * so the seller sees the order in Messages. Does not fire Klaviyo "Message Sent" — sale emails
 * use Shipping Sale Received / New Sale Received / Buyer Order Confirmed instead.
 */
function paymentPhrase(method: OrderPlacedMessagePayload["paymentMethod"]): string {
  if (method === "reswell_bucks") return "wallet"
  if (method === "cash") return "cash"
  return "card"
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

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversation.id)
}
