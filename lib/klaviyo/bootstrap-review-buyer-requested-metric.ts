/**
 * Sends one minimal Events API event so **Review Buyer Requested** appears under
 * Flows → Your metrics → API before any real seller qualifies.
 */

import "@/lib/klaviyo/bootstrap-env"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { REVIEW_BUYER_REQUESTED_METRIC } from "@/lib/klaviyo/track-review-buyer-requested"

const SEED_PROFILE_EXTERNAL_ID = "reswell-metric-seed-review-buyer-requested"

export type BootstrapReviewBuyerRequestedMetricResult = {
  metric_name: string
  ok: boolean
  skipped: boolean
  status: number
  skipReason?: string
  detail: string
}

export async function bootstrapReviewBuyerRequestedMetric(): Promise<{
  result: BootstrapReviewBuyerRequestedMetricResult
}> {
  const time = new Date().toISOString()
  const r = await sendKlaviyoServerEvent({
    metricName: REVIEW_BUYER_REQUESTED_METRIC,
    profile: {
      external_id: SEED_PROFILE_EXTERNAL_ID,
    },
    uniqueId: "reswell-seed-review-buyer-requested",
    properties: {
      time,
      reswell_metric_seed: true,
      order_id: "00000000-0000-0000-0000-000000000000",
      order_num: "SEED",
      listing_id: null,
      Title: "Review buyer requested (metric seed)",
      listing_url: "https://reswell.app",
      sale_url: "https://reswell.app/dashboard/sales",
      review_url: "https://reswell.app/dashboard/sales",
      photo_url: "",
      buyer_display_name: "Buyer",
      review_of: {
        user_id: SEED_PROFILE_EXTERNAL_ID,
        display_name: "Buyer",
      },
    },
  })

  return {
    result: {
      metric_name: REVIEW_BUYER_REQUESTED_METRIC,
      ok: r.ok,
      skipped: r.skipped,
      status: r.status,
      skipReason: r.skipReason,
      detail: r.detail,
    },
  }
}
