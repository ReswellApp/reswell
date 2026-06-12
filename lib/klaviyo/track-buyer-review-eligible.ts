/**
 * Server-only: Klaviyo Events API — fires once when a buyer can leave a seller review on an order
 * (delivery or pickup complete, no existing buyer review).
 *
 * **Metric name in Klaviyo:** `Buyer Review Eligible` — profile is the **buyer** so metric-triggered
 * flows email them. Seller display context lives under `seller` (nested), not top-level scalars.
 *
 * **Building the flow in Klaviyo:**
 * 1. Flows → Create flow → Metric → **Buyer Review Eligible**
 * 2. Add a **Time delay** (recommended: 2–3 days after delivery so buyers have used the item)
 * 3. Add a conditional split: suppress if the buyer has done metric **Placed Order** with a review
 *    (or rely on Reswell only emitting this event once per order via `uniqueId`)
 * 4. Email template — primary CTA link:
 *      `{{ event.review_url }}`
 *    Supporting variables:
 *      `{{ event.order_num }}`, `{{ event.Title }}`, `{{ event.purchase_url }}`,
 *      `{{ event.listing_url }}`, `{{ event.seller.display_name }}`, `{{ event.fulfillment_method }}`
 *
 * Also fires when a seller manually requests a review (**Review Requested** includes the same
 * `review_url` for a faster follow-up email).
 *
 * Manual test / metric bootstrap:
 * - `POST /api/integrations/klaviyo/bootstrap-buyer-review-eligible` — seed metric in Klaviyo UI
 * - `POST /api/integrations/klaviyo/trigger-buyer-review-eligible` — real order payload (Bearer `CRON_SECRET` when set)
 */

import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { buildBuyerReviewSellerUrl } from "@/lib/klaviyo/order-review-url"
import { sendKlaviyoServerEvent, type SendKlaviyoServerEventResult } from "@/lib/klaviyo/send-event"
import { listingDetailHref } from "@/lib/listing-href"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"

export type KlaviyoBuyerReviewEligibleTrigger =
  | "carrier_delivered"
  | "buyer_confirmed_delivery"
  | "pickup_complete"

export const BUYER_REVIEW_ELIGIBLE_METRIC_NAME = "Buyer Review Eligible" as const

export type KlaviyoBuyerReviewEligiblePayload = {
  orderId: string
  orderNum: string
  listingId: string
  listingTitle: string
  listingSlug?: string | null
  listingSection?: string | null
  buyerUserId: string
  sellerUserId: string
  sellerDisplayName: string
  fulfillmentMethod: "shipping" | "pickup"
  trigger: KlaviyoBuyerReviewEligibleTrigger
  /** Appended to Klaviyo `unique_id` for manual test sends (omit in production). */
  dedupeNonce?: string
}

export async function trackKlaviyoBuyerReviewEligible(
  payload: KlaviyoBuyerReviewEligiblePayload,
): Promise<SendKlaviyoServerEventResult> {
  const buyerEmail = await getAuthEmailForUserId(payload.buyerUserId)
  const origin = publicSiteOriginForEmail()
  const listingPath = listingDetailHref({
    id: payload.listingId,
    slug: payload.listingSlug ?? undefined,
    section: payload.listingSection ?? "",
  })
  const listingUrl = `${origin}${listingPath}`
  const purchaseUrl = `${origin}/dashboard/purchases/${payload.orderId}`
  const reviewUrl = buildBuyerReviewSellerUrl(payload.orderId)

  return sendKlaviyoServerEvent({
    metricName: BUYER_REVIEW_ELIGIBLE_METRIC_NAME,
    profile: {
      external_id: payload.buyerUserId,
      email: buyerEmail,
    },
    properties: {
      time: new Date().toISOString(),
      order_id: payload.orderId,
      order_num: payload.orderNum,
      listing_id: payload.listingId,
      Title: payload.listingTitle,
      listing_url: listingUrl,
      purchase_url: purchaseUrl,
      review_url: reviewUrl,
      fulfillment_method: payload.fulfillmentMethod,
      trigger: payload.trigger,
      seller: {
        user_id: payload.sellerUserId,
        display_name: payload.sellerDisplayName,
      },
    },
    uniqueId: payload.dedupeNonce
      ? `buyer-review-eligible-${payload.orderId}-${payload.dedupeNonce}`
      : `buyer-review-eligible-${payload.orderId}`,
  })
}
