/**
 * Sends one minimal Events API event for **Buyer Review Eligible** so Klaviyo lists it under
 * **Flows → Your metrics → API** before any real order completes fulfillment.
 *
 * Uses a synthetic `external_id` and `reswell_metric_seed: true` — exclude in flows via a trigger
 * filter where `event.reswell_metric_seed` is **not true** if needed.
 */

import "@/lib/klaviyo/bootstrap-env"
import { buildBuyerReviewSellerUrl } from "@/lib/klaviyo/order-review-url"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { BUYER_REVIEW_ELIGIBLE_METRIC_NAME } from "@/lib/klaviyo/track-buyer-review-eligible"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"

const SEED_PROFILE_EXTERNAL_ID = "reswell-metric-seed-buyer-review-eligible"
const SEED_ORDER_ID = "00000000-0000-4000-8000-000000000001"

export type BootstrapBuyerReviewEligibleMetricResult = {
  metric_name: string
  ok: boolean
  skipped: boolean
  status: number
  skipReason?: string
  detail: string
}

export async function bootstrapBuyerReviewEligibleMetric(): Promise<{
  result: BootstrapBuyerReviewEligibleMetricResult
}> {
  const time = new Date().toISOString()
  const origin = publicSiteOriginForEmail()
  const reviewUrl = buildBuyerReviewSellerUrl(SEED_ORDER_ID)

  const r = await sendKlaviyoServerEvent({
    metricName: BUYER_REVIEW_ELIGIBLE_METRIC_NAME,
    profile: {
      external_id: SEED_PROFILE_EXTERNAL_ID,
    },
    uniqueId: "reswell-seed-buyer-review-eligible",
    properties: {
      time,
      reswell_metric_seed: true,
      order_id: SEED_ORDER_ID,
      order_num: "SEED-001",
      Title: "Seed listing (ignore in flows)",
      listing_url: `${origin}/boards`,
      purchase_url: `${origin}/dashboard/purchases/${SEED_ORDER_ID}`,
      review_url: reviewUrl,
      fulfillment_method: "shipping",
      trigger: "carrier_delivered",
      seller: {
        user_id: "00000000-0000-4000-8000-000000000002",
        display_name: "Seed Seller",
      },
    },
  })

  return {
    result: {
      metric_name: BUYER_REVIEW_ELIGIBLE_METRIC_NAME,
      ok: r.ok,
      skipped: r.skipped,
      status: r.status,
      skipReason: r.skipReason,
      detail: r.detail,
    },
  }
}
