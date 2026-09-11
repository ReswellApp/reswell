import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateMessagesInboxForParticipants } from "@/lib/cache/revalidate-messages-inbox"
import { getConversationForBuyerSellerListing, ensureConversationForBuyerSellerListing } from "@/lib/db/conversations"
import { getMarketplaceReviewByOrderAndReviewer } from "@/lib/db/order-reviews"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { capitalizeWords } from "@/lib/listing-labels"
import { trackKlaviyoReviewRequested } from "@/lib/klaviyo/track-review-requested"
import { getOrCreateReviewInviteTokenForOrder } from "@/lib/services/orderReviewInvite"
import { validateSellerReviewForOrder } from "@/lib/services/orderSellerReview"
import { parseOrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import { createServiceRoleClient } from "@/lib/supabase/server"
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
  "Thanks again for your purchase on Reswell! When you have a minute, a quick review would mean a lot. Open our message thread and tap Write review to leave a rating if you would like. Thank you."

/** True if this order already has a `review_requested` message in the buyer↔seller thread. */
export async function sellerReviewRequestAlreadySentForOrder(
  supabase: SupabaseClient,
  buyerId: string,
  sellerId: string,
  orderId: string,
  listingId: string | null,
): Promise<boolean> {
  const conversation = await getConversationForBuyerSellerListing(
    supabase,
    buyerId,
    sellerId,
    listingId,
  )
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
      tracking_detail,
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

  const row = order as unknown as OrderRowForReviewRequest & { tracking_detail?: unknown }
  if (row.seller_id !== sellerUserId) {
    return { ok: false, error: "Only the seller for this order can request a review." }
  }

  const trackingDetail = parseOrderTrackingDetail(row.tracking_detail)
  const gate = validateSellerReviewForOrder(
    {
      status: row.status,
      delivery_status: row.delivery_status,
    },
    trackingDetail,
  )
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

  let conversation = await getConversationForBuyerSellerListing(
    supabase,
    row.buyer_id,
    row.seller_id,
    row.listing_id,
  )

  if (!conversation) {
    const ensured = await ensureConversationForBuyerSellerListing(
      supabase,
      row.buyer_id,
      row.seller_id,
      row.listing_id,
    )

    if (!ensured?.id) {
      return { ok: false, error: "Could not open a message thread with the buyer." }
    }
    conversation = { id: ensured.id, listing_id: row.listing_id }
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

  try {
    revalidateMessagesInboxForParticipants(row.buyer_id, row.seller_id)
  } catch {
    // No-op outside Next.js request context (e.g. backfill scripts).
  }

  await emitKlaviyoReviewRequested({
    supabase,
    orderId: row.id,
    orderNum,
    listingId: row.listing_id,
    listingTitle,
    buyerUserId: row.buyer_id,
    sellerUserId,
    conversationId: conversation.id,
    messageId: inserted.id,
    sentAt: inserted.created_at,
    sessionEmail: session?.email ?? null,
  })

  return { ok: true, conversationId: conversation.id }
}

async function findReviewRequestMessageInThread(
  supabase: SupabaseClient,
  conversationId: string,
  orderId: string,
): Promise<{ id: string; created_at: string } | null> {
  const { data: rows } = await supabase
    .from("messages")
    .select("id, created_at, metadata")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(40)

  for (const row of rows ?? []) {
    const p = parseReviewRequestMessageMetadata(row.metadata)
    if (p?.orderId === orderId && typeof row.id === "string" && typeof row.created_at === "string") {
      return { id: row.id, created_at: row.created_at }
    }
  }
  return null
}

async function emitKlaviyoReviewRequested(input: {
  supabase: SupabaseClient
  orderId: string
  orderNum: string
  listingId: string | null
  listingTitle: string
  buyerUserId: string
  sellerUserId: string
  conversationId: string
  messageId: string
  sentAt: string
  sessionEmail?: string | null
}): Promise<void> {
  const { data: senderProfile } = await input.supabase
    .from("profiles")
    .select("display_name, shop_name, is_shop")
    .eq("id", input.sellerUserId)
    .maybeSingle()

  const reviewToken = await getOrCreateReviewInviteTokenForOrder(input.supabase, input.orderId)

  try {
    await trackKlaviyoReviewRequested({
      orderId: input.orderId,
      orderNum: input.orderNum,
      listingId: input.listingId,
      listingTitle: input.listingTitle,
      buyerUserId: input.buyerUserId,
      sellerUserId: input.sellerUserId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      sentAt: input.sentAt,
      reviewToken,
      sessionSeller: {
        email: input.sessionEmail ?? null,
        profile: senderProfile,
      },
    })
  } catch (e) {
    console.error("[seller review request] klaviyo Review Requested:", e)
  }
}

async function emitKlaviyoReviewRequestedForExistingOrder(
  supabase: SupabaseClient,
  order: {
    id: string
    buyer_id: string
    seller_id: string
    listing_id: string | null
  },
): Promise<void> {
  const conversation = await getConversationForBuyerSellerListing(
    supabase,
    order.buyer_id,
    order.seller_id,
    order.listing_id,
  )
  if (!conversation) return

  const message = await findReviewRequestMessageInThread(supabase, conversation.id, order.id)
  if (!message) return

  const { data: orderRow } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      listing_id,
      listings ( id, title ),
      order_items (
        sort_order,
        listings ( id, title )
      )
    `,
    )
    .eq("id", order.id)
    .maybeSingle()

  const listingTitle = orderRow
    ? displayListingTitleSummary(orderRow as unknown as OrderRowForReviewRequest)
    : "Your purchase"
  const orderNum = formatOrderNumForCustomer(
    typeof orderRow?.order_num === "string" ? orderRow.order_num : null,
    order.id,
  )

  await emitKlaviyoReviewRequested({
    supabase,
    orderId: order.id,
    orderNum,
    listingId: order.listing_id,
    listingTitle,
    buyerUserId: order.buyer_id,
    sellerUserId: order.seller_id,
    conversationId: conversation.id,
    messageId: message.id,
    sentAt: message.created_at,
  })
}

export type AutoSendSellerReviewRequestResult =
  | { ok: true; conversationId: string | null; alreadySent: boolean }
  | { ok: false; error: string }

/**
 * System send after delivery/pickup — same in-thread card + Klaviyo `Review Requested`
 * as the former manual Ask for a review button. Idempotent.
 */
export async function autoSendSellerReviewRequestForOrder(
  orderId: string,
): Promise<AutoSendSellerReviewRequestResult> {
  let supabase: SupabaseClient
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    console.error("[seller review request] auto-send service role:", e)
    return { ok: false, error: "Could not send the review request." }
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, buyer_id, seller_id, listing_id, is_admin_test")
    .eq("id", orderId)
    .maybeSingle()

  if (orderErr || !order) {
    return { ok: false, error: "Order not found." }
  }

  if (order.is_admin_test === true) {
    return { ok: true, conversationId: null, alreadySent: false }
  }

  if (!order.buyer_id || !order.seller_id) {
    return { ok: false, error: "Order is missing a buyer or seller." }
  }

  const alreadySent = await sellerReviewRequestAlreadySentForOrder(
    supabase,
    order.buyer_id,
    order.seller_id,
    order.id,
    order.listing_id,
  )
  if (alreadySent) {
    await emitKlaviyoReviewRequestedForExistingOrder(supabase, order)
    return { ok: true, conversationId: null, alreadySent: true }
  }

  const result = await sendSellerReviewRequestForOrder(supabase, order.seller_id, order.id)
  if (!result.ok) {
    if (result.error.includes("already sent")) {
      await emitKlaviyoReviewRequestedForExistingOrder(supabase, order)
      return { ok: true, conversationId: null, alreadySent: true }
    }
    return result
  }

  return { ok: true, conversationId: result.conversationId, alreadySent: false }
}
