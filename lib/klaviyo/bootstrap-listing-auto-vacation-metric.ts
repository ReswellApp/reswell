/**
 * Sends one minimal Events API event so **Listing Auto Vacation** appears under
 * Flows → Your metrics → API before any real seller listing is auto-hidden.
 */

import "@/lib/klaviyo/bootstrap-env"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import {
  LISTING_AUTO_VACATION_HIDE_REASON,
  LISTING_AUTO_VACATION_METRIC,
} from "@/lib/klaviyo/track-listing-auto-vacation"
import { SELLER_MESSAGE_INACTIVITY_DAYS } from "@/lib/db/sellerMessageInactivity"
import { listingVisibilitySourceLabel } from "@/lib/listing-visibility-sources"

const SEED_PROFILE_EXTERNAL_ID = "reswell-metric-seed-listing-auto-vacation"

export type BootstrapListingAutoVacationMetricResult = {
  metric_name: string
  ok: boolean
  skipped: boolean
  status: number
  skipReason?: string
  detail: string
}

export async function bootstrapListingAutoVacationMetric(): Promise<{
  result: BootstrapListingAutoVacationMetricResult
}> {
  const time = new Date().toISOString()
  const r = await sendKlaviyoServerEvent({
    metricName: LISTING_AUTO_VACATION_METRIC,
    profile: {
      external_id: SEED_PROFILE_EXTERNAL_ID,
    },
    uniqueId: "reswell-seed-listing-auto-vacation",
    properties: {
      time,
      reswell_metric_seed: true,
      hide_reason: LISTING_AUTO_VACATION_HIDE_REASON,
      hide_reason_label: listingVisibilitySourceLabel(LISTING_AUTO_VACATION_HIDE_REASON),
      days_unanswered: SELLER_MESSAGE_INACTIVITY_DAYS,
      Title: "Listing auto vacation (metric seed)",
      manage_url: "https://www.reswell.app/dashboard/listings",
    },
  })

  return {
    result: {
      metric_name: LISTING_AUTO_VACATION_METRIC,
      ok: r.ok,
      skipped: r.skipped,
      status: r.status,
      skipReason: r.skipReason,
      detail: r.detail,
    },
  }
}
