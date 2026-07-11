/**
 * Sends one minimal Events API event so **Inactive Seller** appears under
 * **Flows → Your metrics → API** before any real seller qualifies for cron.
 */

import "@/lib/klaviyo/bootstrap-env"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { INACTIVE_SELLER_METRIC } from "@/lib/klaviyo/track-inactive-seller"
import { SELLER_MESSAGE_INACTIVITY_DAYS } from "@/lib/db/sellerMessageInactivity"

const SEED_PROFILE_EXTERNAL_ID = "reswell-metric-seed-inactive-seller"

export type BootstrapInactiveSellerMetricResult = {
  metric_name: string
  ok: boolean
  skipped: boolean
  status: number
  skipReason?: string
  detail: string
}

export async function bootstrapInactiveSellerMetric(): Promise<{
  result: BootstrapInactiveSellerMetricResult
}> {
  const time = new Date().toISOString()
  const r = await sendKlaviyoServerEvent({
    metricName: INACTIVE_SELLER_METRIC,
    profile: {
      external_id: SEED_PROFILE_EXTERNAL_ID,
    },
    uniqueId: "reswell-seed-inactive-seller",
    properties: {
      time,
      reswell_metric_seed: true,
      days_unanswered: SELLER_MESSAGE_INACTIVITY_DAYS,
      vacation_mode_applied: true,
    },
  })

  return {
    result: {
      metric_name: INACTIVE_SELLER_METRIC,
      ok: r.ok,
      skipped: r.skipped,
      status: r.status,
      skipReason: r.skipReason,
      detail: r.detail,
    },
  }
}
