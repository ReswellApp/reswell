import type { SupabaseClient } from "@supabase/supabase-js"
import {
  trackKlaviyoBuyerReviewEligible,
  type KlaviyoBuyerReviewEligibleTrigger,
} from "@/lib/klaviyo/track-buyer-review-eligible"
import type { SendKlaviyoServerEventResult } from "@/lib/klaviyo/send-event"
import { capitalizeWords } from "@/lib/listing-labels"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { getMarketplaceReviewByOrderAndReviewer } from "@/lib/db/order-reviews"
import { canSubmitSellerReview } from "@/lib/services/orderSellerReview"
import { parseOrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"

type OrderListingRow = { id: string; title: string | null; slug?: string | null; section?: string | null }

function unwrapListing<R>(raw: R | R[] | null | undefined): R | null {
  if (raw == null) return null
  return Array.isArray(raw) ? raw[0] ?? null : raw
}

function displayNameFromProfileRow(data: {
  display_name?: string | null
  shop_name?: string | null
  is_shop?: boolean | null
} | null): string {
  if (!data) return "Seller"
  const shop = typeof data.shop_name === "string" ? data.shop_name.trim() : ""
  if (data.is_shop && shop) return shop
  const dn = typeof data.display_name === "string" ? data.display_name.trim() : ""
  return dn || "Seller"
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

function primaryListingRow(order: {
  listing_id: string | null
  listings: OrderListingRow | OrderListingRow[] | null
  order_items?: Array<{ sort_order: number | null; listings: OrderListingRow | OrderListingRow[] | null }> | null
}): OrderListingRow | null {
  const sortedPack = [...(order.order_items ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )
  for (const it of sortedPack) {
    const L = unwrapListing(it.listings)
    if (L) return L
  }
  return unwrapListing(order.listings)
}

/**
 * Emits **Buyer Review Eligible** when fulfillment is complete and the buyer has not reviewed yet.
 * Idempotent per order via Klaviyo `uniqueId`.
 */
export async function notifyBuyerReviewEligibleKlaviyo(
  supabase: SupabaseClient,
  orderId: string,
  trigger: KlaviyoBuyerReviewEligibleTrigger,
  options?: { dedupeNonce?: string; force?: boolean },
): Promise<{ sent: boolean; reason?: string; klaviyo?: SendKlaviyoServerEventResult }> {
  const { data: row, error } = await supabase
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
      fulfillment_method,
      tracking_detail,
      listings ( id, title, slug, section ),
      order_items (
        sort_order,
        listings ( id, title, slug, section )
      )
    `,
    )
    .eq("id", orderId)
    .maybeSingle()

  if (error || !row) {
    if (error) {
      console.error("[notifyBuyerReviewEligibleKlaviyo] order load:", error.message)
    }
    return { sent: false, reason: "order_not_found" }
  }

  const order = row as {
    id: string
    order_num: string | null
    buyer_id: string
    seller_id: string
    listing_id: string | null
    status: string
    delivery_status: string
    fulfillment_method: string | null
    tracking_detail?: unknown
    listings: OrderListingRow | OrderListingRow[] | null
    order_items?: Array<{ sort_order: number | null; listings: OrderListingRow | OrderListingRow[] | null }> | null
  }

  if (order.status === "refunded" || order.status === "refunding") {
    return { sent: false, reason: "order_refunded" }
  }
  if (!order.buyer_id || !order.seller_id) {
    return { sent: false, reason: "missing_participants" }
  }

  const trackingDetail = parseOrderTrackingDetail(order.tracking_detail)
  if (!options?.force && !canSubmitSellerReview(order, trackingDetail)) {
    return { sent: false, reason: "not_review_eligible" }
  }

  const { data: existingReview, error: revErr } = await getMarketplaceReviewByOrderAndReviewer(
    supabase,
    orderId,
    order.buyer_id,
  )
  if (revErr) {
    console.error("[notifyBuyerReviewEligibleKlaviyo] review check:", revErr.message)
    return { sent: false, reason: "review_check_failed" }
  }
  if (!options?.force && existingReview) {
    return { sent: false, reason: "buyer_already_reviewed" }
  }

  const listing = primaryListingRow(order)
  const listingId = listing?.id ?? order.listing_id
  if (!listingId) {
    return { sent: false, reason: "missing_listing" }
  }

  const { data: sellerProfile } = await supabase
    .from("profiles")
    .select("display_name, shop_name, is_shop")
    .eq("id", order.seller_id)
    .maybeSingle()

  const fulfillmentMethod =
    order.fulfillment_method === "pickup" ? "pickup" : "shipping"

  const klaviyo = await trackKlaviyoBuyerReviewEligible({
    orderId: order.id,
    orderNum: formatOrderNumForCustomer(order.order_num, order.id),
    listingId,
    listingTitle: displayListingTitleSummary(order),
    listingSlug: listing?.slug ?? null,
    listingSection: listing?.section ?? null,
    buyerUserId: order.buyer_id,
    sellerUserId: order.seller_id,
    sellerDisplayName: displayNameFromProfileRow(sellerProfile ?? null),
    fulfillmentMethod,
    trigger,
    dedupeNonce: options?.dedupeNonce,
  })

  return { sent: klaviyo.ok, klaviyo, reason: klaviyo.ok ? undefined : klaviyo.skipReason ?? "klaviyo_rejected" }
}
