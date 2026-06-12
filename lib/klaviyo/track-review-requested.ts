/**
 * Server-only: Klaviyo Events API — fires when a seller asks a buyer to leave a review for an order.
 *
 * **Metric name in Klaviyo:** `Review Requested` — profile is the **buyer** so metric-triggered
 * flows email them. Seller display context lives under `request_from` (nested), not top-level scalars.
 *
 * **Building the flow:** Flows → Metric → **Review Requested** → email; use e.g.
 * `{{ event.review_url }}` (direct link — opens the review dialog on the purchase page),
 * `{{ event.order_num }}`, `{{ event.Title }}`, `{{ event.messages_url }}`, `{{ event.purchase_url }}`,
 * `{{ event.request_from.display_name }}`.
 */

import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { buildBuyerReviewSellerUrl } from "@/lib/klaviyo/order-review-url"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { listingDetailHref } from "@/lib/listing-href"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import { createServiceRoleClient } from "@/lib/supabase/server"

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

async function getSellerRequestFromFields(
  sellerId: string,
  sessionSeller?: KlaviyoReviewRequestedPayload["sessionSeller"],
): Promise<{ email: string | null; display_name: string }> {
  const email =
    sessionSeller?.email?.trim() ||
    (await getAuthEmailForUserId(sellerId))

  if (sessionSeller?.profile) {
    return {
      email: email ?? null,
      display_name: displayNameFromProfileRow(sessionSeller.profile),
    }
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return { email: email ?? null, display_name: "" }
  }

  try {
    const supabase = createServiceRoleClient()
    const { data } = await supabase
      .from("profiles")
      .select("display_name, shop_name, is_shop")
      .eq("id", sellerId)
      .maybeSingle()
    return {
      email: email ?? null,
      display_name: displayNameFromProfileRow(data ?? null),
    }
  } catch {
    return { email: email ?? null, display_name: "" }
  }
}

export type KlaviyoReviewRequestedPayload = {
  orderId: string
  orderNum: string
  listingId: string | null
  listingTitle: string
  buyerUserId: string
  sellerUserId: string
  conversationId: string
  messageId: string
  sentAt: string
  /**
   * From server action session + profiles row — avoids service role for seller display fields.
   */
  sessionSeller?: {
    email: string | null
    profile: {
      display_name?: string | null
      shop_name?: string | null
      is_shop?: boolean | null
    } | null
  }
}

export async function trackKlaviyoReviewRequested(
  payload: KlaviyoReviewRequestedPayload,
): Promise<void> {
  const [buyerEmail, requestFrom] = await Promise.all([
    getAuthEmailForUserId(payload.buyerUserId),
    getSellerRequestFromFields(payload.sellerUserId, payload.sessionSeller),
  ])

  let listingSlug: string | null = null
  let listingSection = ""

  if (payload.listingId && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    try {
      const sr = createServiceRoleClient()
      const { data, error } = await sr
        .from("listings")
        .select("slug, section")
        .eq("id", payload.listingId)
        .maybeSingle()

      if (error) {
        console.warn("[klaviyo] Review Requested: listing fetch", error.message)
      } else {
        listingSlug = typeof data?.slug === "string" ? data.slug : null
        listingSection = typeof data?.section === "string" ? data.section : ""
      }
    } catch (e) {
      console.error("[klaviyo] Review Requested: listing enrichment failed", e)
    }
  }

  const origin = publicSiteOriginForEmail()
  const listingPath =
    payload.listingId != null
      ? listingDetailHref({
          id: payload.listingId,
          slug: listingSlug ?? undefined,
          section: listingSection,
        })
      : null
  const listingUrl = listingPath != null ? `${origin}${listingPath}` : null
  const purchaseUrl = `${origin}/dashboard/purchases/${payload.orderId}`
  const reviewUrl = buildBuyerReviewSellerUrl(payload.orderId)
  const messagesUrl = `${origin}/messages/${payload.conversationId}`

  await sendKlaviyoServerEvent({
    metricName: "Review Requested",
    profile: {
      external_id: payload.buyerUserId,
      email: buyerEmail,
    },
    properties: {
      time: payload.sentAt,
      order_id: payload.orderId,
      order_num: payload.orderNum,
      listing_id: payload.listingId,
      Title: payload.listingTitle,
      listing_url: listingUrl,
      purchase_url: purchaseUrl,
      review_url: reviewUrl,
      messages_url: messagesUrl,
      conversation_id: payload.conversationId,
      message_id: payload.messageId,
      request_from: {
        user_id: payload.sellerUserId,
        email: requestFrom.email ?? "",
        display_name: requestFrom.display_name,
      },
    },
    uniqueId: `review-requested-${payload.orderId}`,
  })
}
