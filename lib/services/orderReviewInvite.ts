import type { SupabaseClient } from "@supabase/supabase-js"
import {
  ensureOrderReviewInviteRow,
  getOrderReviewInviteByOrderId,
  getOrderReviewInviteByToken,
  markOrderReviewInvitePhaseSent,
} from "@/lib/db/orderReviewInvites"
import { getMarketplaceReviewByOrderAndReviewer } from "@/lib/db/order-reviews"
import { trackKlaviyoReviewInvite } from "@/lib/klaviyo/track-review-invite"
import { capitalizeWords } from "@/lib/listing-labels"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { orderFulfillmentCompleteForReview } from "@/lib/services/orderSellerReview"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type { OrderReviewInviteRow } from "@/lib/types/order-review-invite"
import { orderReviewInviteUrl } from "@/lib/utils/order-review-invite-token"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import { parseOrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"

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

type OrderRowForInvite = {
  id: string
  order_num: string | null
  buyer_id: string
  seller_id: string
  listing_id: string | null
  status: string
  delivery_status: string
  tracking_detail?: unknown
  is_admin_test?: boolean | null
  listings: OrderListingRow | OrderListingRow[] | null
  order_items?: Array<{ sort_order: number | null; listings: OrderListingRow | OrderListingRow[] | null }> | null
}

async function loadOrderForInvite(
  supabase: SupabaseClient,
  orderId: string,
): Promise<OrderRowForInvite | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      buyer_id,
      seller_id,
      listing_id,
      status,
      delivery_status,
      tracking_detail,
      is_admin_test,
      listings ( id, title ),
      order_items (
        sort_order,
        listings ( id, title )
      )
    `,
    )
    .eq("id", orderId)
    .maybeSingle()

  if (error || !data) {
    if (error) {
      console.error("[orderReviewInvite] order load:", error.message)
    }
    return null
  }

  return data as unknown as OrderRowForInvite
}

function orderEligibleForReviewInvite(order: OrderRowForInvite): boolean {
  if (order.is_admin_test === true) return false
  if (order.status !== "confirmed") return false
  if (!order.buyer_id || !order.seller_id) return false
  return true
}

async function buyerAlreadyReviewed(
  supabase: SupabaseClient,
  orderId: string,
  buyerId: string,
): Promise<boolean> {
  const { data } = await getMarketplaceReviewByOrderAndReviewer(supabase, orderId, buyerId)
  return Boolean(data)
}

export async function ensureOrderReviewInvite(orderId: string): Promise<OrderReviewInviteRow | null> {
  let supabase: SupabaseClient
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    console.error("[orderReviewInvite] service role:", e)
    return null
  }

  const order = await loadOrderForInvite(supabase, orderId)
  if (!order || !orderEligibleForReviewInvite(order)) {
    return null
  }

  const { data, error } = await ensureOrderReviewInviteRow(supabase, {
    orderId: order.id,
    buyerId: order.buyer_id,
    sellerId: order.seller_id,
    listingId: order.listing_id,
  })

  if (error) {
    console.error("[orderReviewInvite] ensure row:", error.message)
    return null
  }

  return data
}

export function buildOrderReviewInviteUrl(token: string): string {
  return orderReviewInviteUrl(token, publicSiteOriginForEmail())
}

async function emitReviewInvitePhase(
  orderId: string,
  phase: "post_purchase" | "fulfillment",
): Promise<void> {
  let supabase: SupabaseClient
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    console.error("[orderReviewInvite] service role:", e)
    return
  }

  const order = await loadOrderForInvite(supabase, orderId)
  if (!order || !orderEligibleForReviewInvite(order)) {
    return
  }

  if (await buyerAlreadyReviewed(supabase, orderId, order.buyer_id)) {
    return
  }

  const { data: invite, error: inviteErr } = await ensureOrderReviewInviteRow(supabase, {
    orderId: order.id,
    buyerId: order.buyer_id,
    sellerId: order.seller_id,
    listingId: order.listing_id,
  })

  if (inviteErr || !invite) {
    console.error("[orderReviewInvite] ensure invite:", inviteErr?.message)
    return
  }

  const alreadySent =
    phase === "post_purchase"
      ? invite.post_purchase_sent_at != null
      : invite.fulfillment_reminder_sent_at != null

  if (alreadySent) {
    return
  }

  if (phase === "fulfillment") {
    const trackingDetail = parseOrderTrackingDetail(order.tracking_detail)
    if (!orderFulfillmentCompleteForReview(order, trackingDetail)) {
      return
    }
  }

  const sentAt = new Date().toISOString()
  const listingTitle = displayListingTitleSummary(order)
  const orderNum = formatOrderNumForCustomer(order.order_num, order.id)

  await trackKlaviyoReviewInvite({
    orderId: order.id,
    orderNum,
    listingId: order.listing_id,
    listingTitle,
    buyerUserId: order.buyer_id,
    sellerUserId: order.seller_id,
    reviewToken: invite.token,
    phase,
    sentAt,
  })

  const { error: markErr } = await markOrderReviewInvitePhaseSent(supabase, orderId, phase, sentAt)
  if (markErr) {
    console.error("[orderReviewInvite] mark phase sent:", markErr.message)
  }
}

/** Fire once after checkout — includes stable `review_url` for Klaviyo. */
export async function sendPostPurchaseReviewInvite(orderId: string): Promise<void> {
  await emitReviewInvitePhase(orderId, "post_purchase")
}

/** Fire once after pickup verified or shipping delivered — skipped if buyer already reviewed. */
export async function sendFulfillmentReviewReminder(orderId: string): Promise<void> {
  await emitReviewInvitePhase(orderId, "fulfillment")
}

export type OrderReviewInvitePageContext = {
  token: string
  orderId: string
  orderNum: string
  listingTitle: string
  sellerName: string
  canSubmitReview: boolean
  fulfillmentComplete: boolean
  existingReview: {
    id: string
    rating: number
    comment: string | null
    created_at: string
  } | null
}

export async function loadOrderReviewInvitePageContext(
  token: string,
  viewerUserId: string,
): Promise<OrderReviewInvitePageContext | null> {
  let supabase: SupabaseClient
  try {
    supabase = createServiceRoleClient()
  } catch {
    return null
  }

  const { data: invite, error: inviteErr } = await getOrderReviewInviteByToken(supabase, token)

  if (inviteErr || !invite) {
    return null
  }

  if (invite.buyer_id !== viewerUserId) {
    return null
  }

  const order = await loadOrderForInvite(supabase, invite.order_id)
  if (!order) {
    return null
  }

  const { data: sellerProfile } = await supabase
    .from("profiles")
    .select("display_name, shop_name, is_shop")
    .eq("id", order.seller_id)
    .maybeSingle()

  const shop = typeof sellerProfile?.shop_name === "string" ? sellerProfile.shop_name.trim() : ""
  const sellerName =
    sellerProfile?.is_shop && shop
      ? shop
      : typeof sellerProfile?.display_name === "string" && sellerProfile.display_name.trim()
        ? sellerProfile.display_name.trim()
        : "Seller"

  const trackingDetail = parseOrderTrackingDetail(order.tracking_detail)
  const fulfillmentComplete = orderFulfillmentCompleteForReview(order, trackingDetail)
  const canSubmitReview = fulfillmentComplete && order.status === "confirmed"

  const { data: existingReview } = await getMarketplaceReviewByOrderAndReviewer(
    supabase,
    invite.order_id,
    viewerUserId,
  )

  return {
    token: invite.token,
    orderId: invite.order_id,
    orderNum: formatOrderNumForCustomer(order.order_num, order.id),
    listingTitle: displayListingTitleSummary(order),
    sellerName,
    canSubmitReview: canSubmitReview && !existingReview,
    fulfillmentComplete,
    existingReview: existingReview
      ? {
          id: existingReview.id,
          rating: existingReview.rating,
          comment: existingReview.comment,
          created_at: existingReview.created_at,
        }
      : null,
  }
}

/** For manual seller review requests — returns invite token if one exists or was created. */
export async function getOrCreateReviewInviteTokenForOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<string | null> {
  const existing = await getOrderReviewInviteByOrderId(supabase, orderId)
  if (existing.data?.token) {
    return existing.data.token
  }

  const invite = await ensureOrderReviewInvite(orderId)
  return invite?.token ?? null
}
