/**
 * Server-only: Klaviyo Events API — asks the **seller** to review the buyer after fulfillment.
 *
 * **Metric name in Klaviyo:** `Review Buyer Requested` — profile is the **seller** so
 * metric-triggered flows email them. Buyer display context lives under `review_of` (nested),
 * not top-level email scalars.
 *
 * **Building the flow:** Flows → Metric → **Review Buyer Requested** → email.
 * Filter `reswell_metric_seed` is not true. Suggested subject:
 * `Please review {{ event.buyer_display_name }}`.
 * Template: `lib/klaviyo/review-buyer-requested-email-liquid.ts`.
 *
 * Variables: `{{ event.order_num }}`, `{{ event.Title }}`, `{{ event.sale_url }}`,
 * `{{ event.buyer_display_name }}`, `{{ event.listing_url }}`.
 */

import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { fetchPrimaryListingImageUrlsForKlaviyo } from "@/lib/klaviyo/fetch-primary-listing-image-urls"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { getBuyerDisplayNameForKlaviyo } from "@/lib/klaviyo/seller-sale-event-helpers"
import { listingDetailHref } from "@/lib/listing-href"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import { createServiceRoleClient } from "@/lib/supabase/server"

export const REVIEW_BUYER_REQUESTED_METRIC = "Review Buyer Requested"

export type KlaviyoReviewBuyerRequestedPayload = {
  orderId: string
  orderNum: string
  listingId: string | null
  listingTitle: string
  sellerUserId: string
  buyerUserId: string
  sentAt?: string
}

export async function trackKlaviyoReviewBuyerRequested(
  payload: KlaviyoReviewBuyerRequestedPayload,
): Promise<void> {
  const [sellerEmail, buyerDisplayName] = await Promise.all([
    getAuthEmailForUserId(payload.sellerUserId),
    getBuyerDisplayNameForKlaviyo(payload.buyerUserId),
  ])

  let listingSlug: string | null = null
  let listingSection = ""
  let photoUrl = ""

  if (payload.listingId && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    try {
      const sr = createServiceRoleClient()
      const [listingRes, photoByListing] = await Promise.all([
        sr.from("listings").select("slug, section").eq("id", payload.listingId).maybeSingle(),
        fetchPrimaryListingImageUrlsForKlaviyo(sr, [payload.listingId]),
      ])

      if (listingRes.error) {
        console.warn("[klaviyo] Review Buyer Requested: listing fetch", listingRes.error.message)
      } else {
        listingSlug = typeof listingRes.data?.slug === "string" ? listingRes.data.slug : null
        listingSection = typeof listingRes.data?.section === "string" ? listingRes.data.section : ""
      }
      photoUrl = photoByListing.get(payload.listingId) ?? ""
    } catch (e) {
      console.error("[klaviyo] Review Buyer Requested: listing enrichment failed", e)
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
  const listingUrl = listingPath != null ? `${origin}${listingPath}` : ""
  const saleUrl = `${origin}/dashboard/sales/${payload.orderId}`

  await sendKlaviyoServerEvent({
    metricName: REVIEW_BUYER_REQUESTED_METRIC,
    profile: {
      external_id: payload.sellerUserId,
      email: sellerEmail,
    },
    properties: {
      time: payload.sentAt ?? new Date().toISOString(),
      order_id: payload.orderId,
      order_num: payload.orderNum,
      listing_id: payload.listingId,
      Title: payload.listingTitle,
      listing_url: listingUrl,
      sale_url: saleUrl,
      review_url: saleUrl,
      photo_url: photoUrl,
      buyer_display_name: buyerDisplayName,
      review_of: {
        user_id: payload.buyerUserId,
        display_name: buyerDisplayName,
      },
    },
    uniqueId: `review-buyer-requested-${payload.orderId}`,
  })
}
