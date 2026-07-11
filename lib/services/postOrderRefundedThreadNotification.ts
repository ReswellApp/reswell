import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateMessagesInboxForParticipants } from "@/lib/cache/revalidate-messages-inbox"
import { getConversationForBuyerSellerListing, ensureConversationForBuyerSellerListing } from "@/lib/db/conversations"
import { trackKlaviyoMessageSent } from "@/lib/klaviyo/track-message-sent"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import {
  parseOrderRefundedMessageMetadata,
  type OrderRefundedMessagePayload,
} from "@/lib/validations/order-refunded-message-metadata"

type OrderRefundedContext = {
  id: string
  order_num: string | null
  buyer_id: string
  seller_id: string
  listing_id: string | null
}

async function orderRefundedNotificationAlreadySent(
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
    const parsed = parseOrderRefundedMessageMetadata(row.metadata)
    if (parsed?.orderId === orderId) return true
  }
  return false
}

function buildOrderRefundedPlainText(params: {
  displayOrderNum: string
  listingTitle: string
  listingTitles: string[]
}): string {
  const { displayOrderNum, listingTitle, listingTitles } = params
  const titles = listingTitles.map((t) => t.trim()).filter(Boolean)
  const itemLine =
    titles.length <= 1
      ? `"${titles[0] ?? listingTitle}"`
      : titles.map((t) => `• "${t}"`).join("\n")

  return [
    `Reswell: Order #${displayOrderNum} was refunded.`,
    "",
    titles.length <= 1 ? `Item: ${itemLine}` : ["Items:", itemLine].join("\n"),
    "",
    "The listing is back on the market and live on Reswell again.",
    "Any seller earnings from this sale have been reversed per our refund policy.",
  ].join("\n")
}

function listingTitleSummary(listingTitles: string[]): string {
  const cleaned = listingTitles.map((t) => t.trim()).filter(Boolean)
  if (cleaned.length === 0) return "Item"
  if (cleaned.length === 1) return cleaned[0]!
  return `${cleaned.length} items — ${cleaned.map((t) => `"${t}"`).join(", ")}`
}

async function loadListingTitlesForOrder(
  supabase: SupabaseClient,
  order: OrderRefundedContext,
): Promise<{ primaryListingId: string; listingTitles: string[] }> {
  const listingIds = new Set<string>()
  if (order.listing_id) listingIds.add(order.listing_id)

  const { data: items } = await supabase
    .from("order_items")
    .select("listing_id")
    .eq("order_id", order.id)

  for (const row of items ?? []) {
    const id = (row as { listing_id?: string | null }).listing_id
    if (typeof id === "string" && id.length > 0) listingIds.add(id)
  }

  const ids = [...listingIds]
  if (ids.length === 0) {
    throw new Error("Order has no listing references")
  }

  const { data: listings } = await supabase.from("listings").select("id, title").in("id", ids)
  const titleById = new Map(
    (listings ?? []).map((row) => [
      (row as { id: string }).id,
      typeof (row as { title?: string }).title === "string"
        ? (row as { title: string }).title.trim() || "Item"
        : "Item",
    ]),
  )

  const listingTitles = ids.map((id) => titleById.get(id) ?? "Item")
  const primaryListingId = order.listing_id && listingIds.has(order.listing_id)
    ? order.listing_id
    : ids[0]!

  return { primaryListingId, listingTitles }
}

/**
 * Posts a buyer–seller thread message when a marketplace order is fully refunded or cancelled.
 * Idempotent per order — safe on webhook retries and backfills.
 */
export async function postOrderRefundedThreadNotification(
  supabase: SupabaseClient,
  params: {
    orderId: string
    orderNum: string | null
    buyerId: string
    sellerId: string
    primaryListingId: string
    listingTitles: string[]
  },
): Promise<void> {
  let conv = await getConversationForBuyerSellerListing(
    supabase,
    params.buyerId,
    params.sellerId,
    params.primaryListingId,
  )

  if (!conv) {
    const ensured = await ensureConversationForBuyerSellerListing(
      supabase,
      params.buyerId,
      params.sellerId,
      params.primaryListingId,
    )
    if (!ensured) {
      console.error("[postOrderRefunded] conversation insert failed", { orderId: params.orderId })
      return
    }
    conv = { id: ensured.id, listing_id: params.primaryListingId }
  }

  const alreadySent = await orderRefundedNotificationAlreadySent(supabase, conv.id, params.orderId)
  if (alreadySent) return

  const displayOrderNum = formatOrderNumForCustomer(params.orderNum, params.orderId)
  const listingTitle = listingTitleSummary(params.listingTitles)
  const content = buildOrderRefundedPlainText({
    displayOrderNum,
    listingTitle,
    listingTitles: params.listingTitles,
  })

  const metadata: OrderRefundedMessagePayload = {
    kind: "order_refunded",
    orderId: params.orderId,
    orderNum: displayOrderNum,
    listingTitle,
    ...(params.listingTitles.length > 1 ? { listingTitles: params.listingTitles } : {}),
  }

  const { data: inserted, error: msgErr } = await supabase
    .from("messages")
    .insert({
      conversation_id: conv.id,
      sender_id: params.buyerId,
      content,
      metadata,
    })
    .select("id, created_at")
    .single()

  if (msgErr || !inserted) {
    console.error("[postOrderRefunded] message insert failed:", msgErr)
    return
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conv.id)

  try {
    revalidateMessagesInboxForParticipants(params.buyerId, params.sellerId)
  } catch {
    // No-op outside Next.js request context (e.g. backfill scripts).
  }

  void trackKlaviyoMessageSent({
    senderUserId: params.buyerId,
    receiverUserId: params.sellerId,
    message: content,
    conversationId: conv.id,
    listingId: params.primaryListingId,
    messageId: inserted.id,
    sentAt: inserted.created_at,
  })
}

/** Loads order context and posts the refund thread message to the seller. */
export async function ensureOrderRefundedSellerThreadNotification(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, order_num, buyer_id, seller_id, listing_id, status")
    .eq("id", orderId)
    .maybeSingle()

  if (error || !order) {
    console.error("[ensureOrderRefunded] order load:", error?.message ?? "not found")
    return
  }

  if ((order as { status?: string }).status !== "refunded") {
    return
  }

  const ctx = order as OrderRefundedContext
  if (!ctx.buyer_id || !ctx.seller_id) {
    console.error("[ensureOrderRefunded] missing buyer or seller", { orderId })
    return
  }

  let primaryListingId: string
  let listingTitles: string[]
  try {
    const loaded = await loadListingTitlesForOrder(supabase, ctx)
    primaryListingId = loaded.primaryListingId
    listingTitles = loaded.listingTitles
  } catch (e) {
    console.error("[ensureOrderRefunded] listing context", e)
    return
  }

  await postOrderRefundedThreadNotification(supabase, {
    orderId: ctx.id,
    orderNum: ctx.order_num,
    buyerId: ctx.buyer_id,
    sellerId: ctx.seller_id,
    primaryListingId,
    listingTitles,
  })
}
