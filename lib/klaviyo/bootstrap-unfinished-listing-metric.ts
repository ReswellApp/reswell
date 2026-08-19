/**
 * Sends one minimal Events API event so **Unfinished Listing** appears under
 * Flows → Your metrics → API before any real seller qualifies for cron.
 */

import "@/lib/klaviyo/bootstrap-env"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { UNFINISHED_LISTING_METRIC } from "@/lib/klaviyo/track-unfinished-listing"

const SEED_PROFILE_EXTERNAL_ID = "reswell-metric-seed-unfinished-listing"

export type BootstrapUnfinishedListingMetricResult = {
  metric_name: string
  ok: boolean
  skipped: boolean
  status: number
  skipReason?: string
  detail: string
}

export async function bootstrapUnfinishedListingMetric(): Promise<{
  result: BootstrapUnfinishedListingMetricResult
}> {
  const time = new Date().toISOString()
  const r = await sendKlaviyoServerEvent({
    metricName: UNFINISHED_LISTING_METRIC,
    profile: {
      external_id: SEED_PROFILE_EXTERNAL_ID,
    },
    uniqueId: "reswell-seed-unfinished-listing",
    properties: {
      time,
      reswell_metric_seed: true,
      Created: false,
      Title: "Unfinished listing (metric seed)",
      Resume_URL: "https://reswell.app/sell",
      "Needs listing nudge": true,
    },
  })

  return {
    result: {
      metric_name: UNFINISHED_LISTING_METRIC,
      ok: r.ok,
      skipped: r.skipped,
      status: r.status,
      skipReason: r.skipReason,
      detail: r.detail,
    },
  }
}
