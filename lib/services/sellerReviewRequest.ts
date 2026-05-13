import type { SupabaseClient } from "@supabase/supabase-js"
import { getConversationForBuyerSeller } from "@/lib/db/conversations"
import { getMarketplaceReviewByOrderAndReviewer } from "@/lib/db/order-reviews"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { capitalizeWords } from "@/lib/listing-labels"
import { trackKlaviyoMessageSent } from "@/lib/klaviyo/track-message-sent"
import { validateSellerReviewForOrder } from "@/lib/services/orderSellerReview"
import type { ReviewRequestMessagePayload } from "@/lib/validations/review-request-message-metadata"
import { parseReviewRequestMessageMetadata } from "@/lib/validations/review-request-message-metadata"

type OrderListingRow = { id: string; title: string | null }

function unwrapListing<R>(raw: R | R[] | null | undefined): R | null {
  if (raw == null) return null
  return Array.isArray(raw) ? raw[0] ?? null : raw
}

function displayListingTitleSummary(order: {
  listings: OrderListingRow | OrderListingRow[] | null
  order_items?: Array<{ sort_order: number | null; listings: OrderListingRow | OrderListingRow[] | null }> | null
}): string {
  const sortedPack = [...(order.order_items ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )
  const linesFromPack: OrderListingRow[] = []
  for (const it of sortedPack) {
    const L = unwrapListing(it.listings)
    if (L) linesFromPack.push(L)
  }
  const fallback = unwrapListing(order.listings)
  const displayListings = linesFromPack.length > 0 ? linesFromPack : fallback ? [fallback] : []
  if (displayListings.length === 0) return "Your purchase"
  if (displayListings.length > 1) {
    return displayListings.map((l) => capitalizeWords(l.title ?? "")).filter(Boolean).join(" · ")
  }
  return capitalizeWords(displayListings[0]?.title ?? "") || "Your purchase"
}

const REVIEW_REQUEST_MESSAGE =
  "Thanks again for getting a board on Reswell! When you have a minute, a quick review would mean a lot. Open our message thread and tap Write review to leave a rating if you would like. Thank you."

/** True if this order already has a `review_requested` message in the buyer↔seller thread. */
export async function sellerReviewRequestAlreadySentForOrder(
  supabase: SupabaseClient,
  buyerId: string,
  sellerId: string,
  orderId: string,
): Promise<boolean> {
  const conversation = await getConversationForBuyerSeller(supabase, buyerId, sellerId)
  if (!conversation) return false
  return hasExistingReviewRequestInThread(supabase, conversation.id, orderId)
}

async function hasExistingReviewRequestInThread(
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
    const p = parseReviewRequestMessageMetadata(row.metadata)
    if (p?.orderId === orderId) return true
  }
  return false
}

type OrderRowForReviewRequest = {
  id: string
  order_num: string | null
  buyer_id: string
  seller_id: string
  status: string
  delivery_status: string
  listing_id: string | null
  listings: OrderListingRow | OrderListingRow[] | null
  order_items?: Array<{ sort_order: number | null; listings: OrderListingRow | OrderListingRow[] | null }> | null
}

export async function sendSellerReviewRequestForOrder(
  supabase: SupabaseClient,
  sellerUserId: string,
  orderId: string,
  session?: { email?: string | null },
): Promise<{ ok: true; conversationId: string } | { ok: false; error: string }> {
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      buyer_id,
      seller_id,
      status,
      delivery_status,
      listing_id,
      listings ( id, title ),
      order_items (
        sort_order,
        listings ( id, title )
      )
    `,
    )
    .eq("id", orderId)
    .maybeSingle()

  if (orderErr || !order) {
    return { ok: false, error: "Order not found." }
  }

  const row = order as unknown as OrderRowForReviewRequest
  if (row.seller_id !== sellerUserId) {
    return { ok: false, error: "Only the seller for this order can request a review." }
  }

  const gate = validateSellerReviewForOrder({
    status: row.status,
    delivery_status: row.delivery_status,
  })
  if (!gate.ok) {
    return { ok: false, error: gate.error }
  }

  const { data: existingReview, error: revErr } = await getMarketplaceReviewByOrderAndReviewer(
    supabase,
    orderId,
    row.buyer_id,
  )
  if (revErr) {
    return { ok: false, error: "Could not check existing reviews." }
  }
  if (existingReview) {
    return { ok: false, error: "This buyer already left a review for this order." }
  }

  let conversation = await getConversationForBuyerSeller(supabase, row.buyer_id, row.seller_id)

  if (!conversation) {
    const { data: created, error: convError } = await supabase
      .from("conversations")
      .insert({
        buyer_id: row.buyer_id,
        seller_id: row.seller_id,
        listing_id: row.listing_id,
      })
      .select("id")
      .single()

    if (convError || !created?.id) {
      return { ok: false, error: "Could not open a message thread with the buyer." }
    }
    conversation = { id: created.id, listing_id: row.listing_id }
  }

  const dup = await hasExistingReviewRequestInThread(supabase, conversation.id, orderId)
  if (dup) {
    return { ok: false, error: "You already sent a review request for this order in messages." }
  }

  const listingTitle = displayListingTitleSummary(row)
  const orderNum = formatOrderNumForCustomer(row.order_num, row.id)

  const metadata: ReviewRequestMessagePayload = {
    kind: "review_requested",
    orderId: row.id,
    orderNum,
    listingTitle,
  }

  const { data: inserted, error: msgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      sender_id: sellerUserId,
      content: REVIEW_REQUEST_MESSAGE,
      metadata,
    })
    .select("id, created_at")
    .single()

  if (msgError || !inserted) {
    console.error("[seller review request] message insert:", msgError)
    return { ok: false, error: "Could not send the review request." }
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversation.id)

  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("display_name, shop_name, is_shop")
    .eq("id", sellerUserId)
    .maybeSingle()

  void trackKlaviyoMessageSent({
    senderUserId: sellerUserId,
    receiverUserId: row.buyer_id,
    message: REVIEW_REQUEST_MESSAGE,
    conversationId: conversation.id,
    listingId: row.listing_id,
    messageId: inserted.id,
    sentAt: inserted.created_at,
    sessionSender: {
      email: session?.email ?? null,
      profile: senderProfile,
    },
  })

  return { ok: true, conversationId: conversation.id }
}
