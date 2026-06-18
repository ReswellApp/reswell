/**
 * Server-only: Klaviyo Events API — automated review invite emails for buyers.
 *
 * **Metric name in Klaviyo:** `Review Invite Sent`
 *
 * Properties include `phase`:
 * - `post_purchase` — fired once after checkout completes
 * - `fulfillment` — fired once after pickup code verified or shipping delivered (skipped if buyer already reviewed)
 *
 * **Template variables:** `{{ event.review_url }}`, `{{ event.order_num }}`, `{{ event.Title }}`,
 * `{{ event.purchase_url }}`, `{{ event.request_from.display_name }}`, `{{ event.phase }}`.
 */

import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { listingDetailHref } from "@/lib/listing-href"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type { OrderReviewInvitePhase } from "@/lib/types/order-review-invite"
import { orderReviewInviteUrl } from "@/lib/utils/order-review-invite-token"

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

async function getSellerRequestFromFields(sellerId: string): Promise<{ email: string | null; display_name: string }> {
  const email = await getAuthEmailForUserId(sellerId)

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

export type KlaviyoReviewInvitePayload = {
  orderId: string
  orderNum: string
  listingId: string | null
  listingTitle: string
  buyerUserId: string
  sellerUserId: string
  reviewToken: string
  phase: OrderReviewInvitePhase
  sentAt: string
}

export async function trackKlaviyoReviewInvite(payload: KlaviyoReviewInvitePayload): Promise<void> {
  const [buyerEmail, requestFrom] = await Promise.all([
    getAuthEmailForUserId(payload.buyerUserId),
    getSellerRequestFromFields(payload.sellerUserId),
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
        console.warn("[klaviyo] Review Invite Sent: listing fetch", error.message)
      } else {
        listingSlug = typeof data?.slug === "string" ? data.slug : null
        listingSection = typeof data?.section === "string" ? data.section : ""
      }
    } catch (e) {
      console.error("[klaviyo] Review Invite Sent: listing enrichment failed", e)
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
  const reviewUrl = orderReviewInviteUrl(payload.reviewToken, origin)

  await sendKlaviyoServerEvent({
    metricName: "Review Invite Sent",
    profile: {
      external_id: payload.buyerUserId,
      email: buyerEmail,
    },
    properties: {
      time: payload.sentAt,
      phase: payload.phase,
      order_id: payload.orderId,
      order_num: payload.orderNum,
      listing_id: payload.listingId,
      Title: payload.listingTitle,
      listing_url: listingUrl,
      purchase_url: purchaseUrl,
      review_url: reviewUrl,
      request_from: {
        user_id: payload.sellerUserId,
        email: requestFrom.email ?? "",
        display_name: requestFrom.display_name,
      },
    },
    uniqueId: `review-invite-${payload.orderId}-${payload.phase}`,
  })
}
