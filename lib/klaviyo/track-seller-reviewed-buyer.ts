/**
 * Server-only: Klaviyo Events API — fires when a seller submits their rating of a buyer for an order.
 *
 * **Metric name in Klaviyo:** `Seller Reviewed Buyer` — profile is the **buyer** so metric-triggered
 * flows email them. Seller display context lives under `review_from` (nested), not top-level scalars.
 *
 * **Building the flow:** Flows → Metric → **Seller Reviewed Buyer** → email; use e.g.
 * `{{ event.order_num }}`, `{{ event.purchase_url }}`, `{{ event.rating }}`, `{{ event.comment }}`,
 * `{{ event.Title }}`, `{{ event.review_from.display_name }}`.
 */

import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { listingDetailHref } from "@/lib/listing-href"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { createServiceRoleClient } from "@/lib/supabase/server"

const COMMENT_PROP_MAX = 2000

function displayNameFromProfileRow(data: {
  display_name?: string | null
  shop_name?: string | null
  is_shop?: boolean | null
} | null): string {
  if (!data) return ""
  const shop = typeof data.shop_name === "string" ? data.shop_name.trim() : ""
  if (data.is_shop && shop) return shop
  const dn = typeof data.display_name === "string" ? data.display_name.trim() : ""
  return dn || "Seller"
}

export type KlaviyoSellerReviewedBuyerPayload = {
  orderId: string
  buyerUserId: string
  sellerUserId: string
  listingId: string
  rating: number
  comment: string | null
}

export async function trackKlaviyoSellerReviewedBuyer(
  payload: KlaviyoSellerReviewedBuyerPayload,
): Promise<void> {
  const buyerEmail = await getAuthEmailForUserId(payload.buyerUserId)

  let orderNum: string | null = null
  let listingTitle = ""
  let listingSlug: string | null = null
  let listingSection = ""
  let sellerDisplayName = ""

  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    try {
      const sr = createServiceRoleClient()
      const [orderRes, listingRes, sellerRes] = await Promise.all([
        sr.from("orders").select("order_num").eq("id", payload.orderId).maybeSingle(),
        sr
          .from("listings")
          .select("title, slug, section")
          .eq("id", payload.listingId)
          .maybeSingle(),
        sr
          .from("profiles")
          .select("display_name, shop_name, is_shop")
          .eq("id", payload.sellerUserId)
          .maybeSingle(),
      ])

      if (orderRes.error) {
        console.warn("[klaviyo] Seller Reviewed Buyer: order fetch", orderRes.error.message)
      } else if (typeof orderRes.data?.order_num === "string") {
        const trimmed = orderRes.data.order_num.trim()
        orderNum = trimmed || null
      }

      if (listingRes.error) {
        console.warn("[klaviyo] Seller Reviewed Buyer: listing fetch", listingRes.error.message)
      } else {
        const lr = listingRes.data
        listingTitle = typeof lr?.title === "string" ? lr.title : ""
        listingSlug = typeof lr?.slug === "string" ? lr.slug : null
        listingSection = typeof lr?.section === "string" ? lr.section : ""
      }

      if (sellerRes.error) {
        console.warn("[klaviyo] Seller Reviewed Buyer: profile fetch", sellerRes.error.message)
      } else {
        sellerDisplayName = displayNameFromProfileRow(sellerRes.data ?? null)
      }
    } catch (e) {
      console.error("[klaviyo] Seller Reviewed Buyer: enrichment failed", e)
    }
  }

  const origin = publicSiteOrigin()
  const listingPath = listingDetailHref({
    id: payload.listingId,
    slug: listingSlug ?? undefined,
    section: listingSection,
  })
  const listingUrl = `${origin}${listingPath}`
  const purchaseUrl = `${origin}/dashboard/purchases/${payload.orderId}`

  const rawComment =
    typeof payload.comment === "string" && payload.comment.trim() !== ""
      ? payload.comment.trim()
      : null
  const comment =
    rawComment && rawComment.length > COMMENT_PROP_MAX
      ? `${rawComment.slice(0, COMMENT_PROP_MAX)}…`
      : rawComment

  await sendKlaviyoServerEvent({
    metricName: "Seller Reviewed Buyer",
    profile: {
      external_id: payload.buyerUserId,
      email: buyerEmail,
    },
    properties: {
      time: new Date().toISOString(),
      order_id: payload.orderId,
      order_num: formatOrderNumForCustomer(orderNum, payload.orderId),
      listing_id: payload.listingId,
      Title: listingTitle,
      listing_url: listingUrl,
      purchase_url: purchaseUrl,
      rating: payload.rating,
      comment,
      review_from: {
        user_id: payload.sellerUserId,
        display_name: sellerDisplayName,
      },
    },
    uniqueId: `seller-reviewed-buyer-${payload.orderId}`,
  })
}
