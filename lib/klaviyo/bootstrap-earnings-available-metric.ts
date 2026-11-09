/**
 * Sends one minimal Events API event so **Earnings Available** appears under
 * Flows → Your metrics → API before any real seller qualifies.
 */

import "@/lib/klaviyo/bootstrap-env"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { EARNINGS_AVAILABLE_METRIC } from "@/lib/klaviyo/track-earnings-available"

const SEED_PROFILE_EXTERNAL_ID = "reswell-metric-seed-earnings-available"

export type BootstrapEarningsAvailableMetricResult = {
  metric_name: string
  ok: boolean
  skipped: boolean
  status: number
  skipReason?: string
  detail: string
}

export async function bootstrapEarningsAvailableMetric(): Promise<{
  result: BootstrapEarningsAvailableMetricResult
}> {
  const time = new Date().toISOString()
  const r = await sendKlaviyoServerEvent({
    metricName: EARNINGS_AVAILABLE_METRIC,
    profile: {
      external_id: SEED_PROFILE_EXTERNAL_ID,
    },
    uniqueId: "reswell-seed-earnings-available",
    properties: {
      time,
      reswell_metric_seed: true,
      order_id: "00000000-0000-0000-0000-000000000000",
      order_num: "SEED",
      listing_id: null,
      Title: "Earnings available (metric seed)",
      listing_url: "https://reswell.app",
      listing_image_url: "",
      photo_url: "",
      has_product_image: false,
      sale_url: "https://reswell.app/dashboard/sales",
      order_url: "https://reswell.app/dashboard/sales",
      earnings_url: "https://reswell.app/dashboard/earnings",
      order_amount: 0,
      seller_earnings: 0,
      platform_fee: 0,
      fulfillment_method: "shipping",
      payment_method: "stripe",
    },
  })

  return {
    result: {
      metric_name: EARNINGS_AVAILABLE_METRIC,
      ok: r.ok,
      skipped: r.skipped,
      status: r.status,
      skipReason: r.skipReason,
      detail: r.detail,
    },
  }
}
