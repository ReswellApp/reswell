import type { SupabaseClient } from "@supabase/supabase-js"
import { getConversationForBuyerSellerListing, ensureConversationForBuyerSellerListing } from "@/lib/db/conversations"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"

const SHIPPING_LABEL_READY_KIND = "shipping_label_ready" as const

type ShippingLabelReadyMetadata = {
  kind: typeof SHIPPING_LABEL_READY_KIND
  orderId: string
}

function parseShippingLabelReadyMetadata(metadata: unknown): ShippingLabelReadyMetadata | null {
  if (!metadata || typeof metadata !== "object") return null
  const m = metadata as { kind?: unknown; orderId?: unknown }
  if (m.kind !== SHIPPING_LABEL_READY_KIND) return null
  if (typeof m.orderId !== "string" || !m.orderId.trim()) return null
  return { kind: SHIPPING_LABEL_READY_KIND, orderId: m.orderId.trim() }
}

async function shippingLabelReadyNotificationAlreadySent(
  supabase: SupabaseClient,
  conversationId: string,
  orderId: string,
): Promise<boolean> {
  const { data: rows } = await supabase
    .from("messages")
    .select("metadata")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(40)

  for (const row of rows ?? []) {
    const parsed = parseShippingLabelReadyMetadata(row.metadata)
    if (parsed?.orderId === orderId) return true
  }
  return false
}

function buildShippingLabelReadyMessage(params: {
  displayOrderNum: string
  listingTitle: string
  trackingNumber: string | null
  trackingCarrier: string | null
}): string {
  const carrier = params.trackingCarrier?.trim() || null
  const track = params.trackingNumber?.trim() || null

  return [
    `Reswell: shipping label ready for order #${params.displayOrderNum} — ${params.listingTitle}`,
    "",
    track ? `Tracking: ${track}` : null,
    carrier ? `Carrier: ${carrier}` : null,
    "",
    "Seller: open your sale page to view or download the label PDF, print it, and drop the package with the carrier.",
    track
      ? "Buyer: this tracking number is on your purchase page. The seller confirms shipment after drop-off; delivery and payout timing follow the normal Reswell flow."
      : "Buyer: the seller received the label on their sale page; tracking will appear on your purchase when it is added.",
  ]
    .filter((line): line is string => line != null && line.length > 0)
    .join("\n")
}

/**
 * Posts a buyer–seller thread message when a Reswell-purchased shipping label is ready.
 * Idempotent per order — safe to call after attach or on checkout retries.
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

  const alreadySent = await shippingLabelReadyNotificationAlreadySent(
    supabase,
    conv.id,
    params.orderId,
  )
  if (alreadySent) return

  const displayOrderNum = formatOrderNumForCustomer(params.orderNum, params.orderId)
  const content = buildShippingLabelReadyMessage({
    displayOrderNum,
    listingTitle: params.listingTitle,
    trackingNumber: params.trackingNumber,
    trackingCarrier: params.trackingCarrier,
  })

  const metadata: ShippingLabelReadyMetadata = {
    kind: SHIPPING_LABEL_READY_KIND,
    orderId: params.orderId,
  }

  const { error: msgErr } = await supabase.from("messages").insert({
    conversation_id: conv.id,
    sender_id: params.sellerId,
    content,
    metadata,
  })

  if (msgErr) {
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
}
