import type { SupabaseClient } from "@supabase/supabase-js"
import { getConversationForBuyerSellerListing, ensureConversationForBuyerSellerListing } from "@/lib/db/conversations"
import { getSellerEmailForKlaviyo } from "@/lib/klaviyo/seller-sale-event-helpers"
import { trackKlaviyoSellerShippingLabelReady } from "@/lib/klaviyo/track-seller-shipping-label-ready"
import { buildShippingLabelThreadPlainText } from "@/lib/messages/shipping-label-thread"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import type { ShippingLabelReadyMessagePayload } from "@/lib/validations/shipping-label-message-metadata"

const SHIPPING_LABEL_READY_KIND = "shipping_label_ready" as const

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505"
}

async function shippingLabelReadyNotificationAlreadySent(
  supabase: SupabaseClient,
  orderId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("messages")
    .select("id")
    .contains("metadata", { kind: SHIPPING_LABEL_READY_KIND, orderId })
    .limit(1)

  if (error) {
    console.error("[postReswellShippingLabelReady] already-sent check:", error.message)
    return false
  }
  return Boolean(data?.[0]?.id)
}

function buildShippingLabelReadyMessage(params: {
  displayOrderNum: string
  listingTitle: string
  trackingNumber: string | null
  trackingCarrier: string | null
}): string {
  return buildShippingLabelThreadPlainText({
    orderNum: params.displayOrderNum,
    listingTitle: params.listingTitle,
    trackingNumber: params.trackingNumber,
    trackingCarrier: params.trackingCarrier,
  })
}

/**
 * Posts a buyer–seller thread message when a Reswell-purchased shipping label is ready.
 * Idempotent per order — checkout finalize and the Stripe webhook can overlap; the unique
 * index on shipping_label_ready metadata makes the second insert a no-op.
 */
export async function postReswellShippingLabelReadyThreadNotification(
  supabase: SupabaseClient,
  params: {
    orderId: string
    orderNum: string | null
    buyerId: string
    sellerId: string
    listingId: string
    listingTitle: string
    trackingNumber: string | null
    trackingCarrier: string | null
  },
): Promise<void> {
  let conv = await getConversationForBuyerSellerListing(
    supabase,
    params.buyerId,
    params.sellerId,
    params.listingId,
  )

  if (!conv) {
    const ensured = await ensureConversationForBuyerSellerListing(
      supabase,
      params.buyerId,
      params.sellerId,
      params.listingId,
    )
    if (!ensured) {
      console.error("[postReswellShippingLabelReady] conversation insert failed")
      return
    }
    conv = { id: ensured.id, listing_id: params.listingId }
  }

  const alreadySent = await shippingLabelReadyNotificationAlreadySent(supabase, params.orderId)
  if (alreadySent) return

  const displayOrderNum = formatOrderNumForCustomer(params.orderNum, params.orderId)
  const content = buildShippingLabelReadyMessage({
    displayOrderNum,
    listingTitle: params.listingTitle,
    trackingNumber: params.trackingNumber,
    trackingCarrier: params.trackingCarrier,
  })

  const metadata: ShippingLabelReadyMessagePayload = {
    kind: SHIPPING_LABEL_READY_KIND,
    orderId: params.orderId,
    orderNum: displayOrderNum,
    listingTitle: params.listingTitle,
    trackingNumber: params.trackingNumber?.trim() || null,
    trackingCarrier: params.trackingCarrier?.trim() || null,
  }

  const { error: msgErr } = await supabase.from("messages").insert({
    conversation_id: conv.id,
    sender_id: params.sellerId,
    content,
    metadata,
  })

  if (msgErr) {
    if (isUniqueViolation(msgErr)) return
    console.error("[postReswellShippingLabelReady] message insert:", msgErr.message)
    return
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conv.id)
}

/** Loads order context and posts the label-ready thread message when a label exists. */
export async function ensureReswellShippingLabelReadyThreadNotification(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      buyer_id,
      seller_id,
      listing_id,
      tracking_number,
      tracking_carrier,
      listings ( title )
    `,
    )
    .eq("id", orderId)
    .maybeSingle()

  if (error || !order) {
    console.error("[ensureReswellShippingLabelReady] order load:", error?.message ?? "not found")
    return
  }

  const listing = Array.isArray(order.listings) ? order.listings[0] : order.listings
  const listingTitle =
    typeof (listing as { title?: string } | null)?.title === "string"
      ? (listing as { title: string }).title.trim() || "Item"
      : "Item"

  await postReswellShippingLabelReadyThreadNotification(supabase, {
    orderId: order.id as string,
    orderNum: (order.order_num as string | null) ?? null,
    buyerId: order.buyer_id as string,
    sellerId: order.seller_id as string,
    listingId: order.listing_id as string,
    listingTitle,
    trackingNumber: (order.tracking_number as string | null) ?? null,
    trackingCarrier: (order.tracking_carrier as string | null) ?? null,
  })

  const sellerEmail = await getSellerEmailForKlaviyo(order.seller_id as string)
  void trackKlaviyoSellerShippingLabelReady({
    sellerUserId: order.seller_id as string,
    sellerEmail,
    orderId: order.id as string,
    orderNum: (order.order_num as string | null) ?? null,
    listingTitle,
    trackingNumber: (order.tracking_number as string | null) ?? null,
    trackingCarrier: (order.tracking_carrier as string | null) ?? null,
  })
}
