/**
 * Sends one minimal Events API event so **Platform Error Digest** appears under
 * Flows → Your metrics → API before the daily cron finds real issues.
 */

import "@/lib/klaviyo/bootstrap-env"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

export const PLATFORM_ERROR_DIGEST_METRIC = "Platform Error Digest"
const SEED_PROFILE_EXTERNAL_ID = "reswell-metric-seed-platform-errors"

export type BootstrapPlatformErrorDigestResult = {
  metric_name: string
  ok: boolean
  skipped: boolean
  status: number
  skipReason?: string
  detail: string
}

export async function bootstrapPlatformErrorDigestMetric(): Promise<{
  result: BootstrapPlatformErrorDigestResult
}> {
  const time = new Date().toISOString()
  const r = await sendKlaviyoServerEvent({
    metricName: PLATFORM_ERROR_DIGEST_METRIC,
    profile: {
      external_id: SEED_PROFILE_EXTERNAL_ID,
    },
    uniqueId: "reswell-seed-platform-error-digest",
    properties: {
      time,
      reswell_metric_seed: true,
      range_hours: 24,
      issue_count: 0,
      critical_count: 0,
      warning_count: 0,
      issues: [],
      note: "Seed event — ignore in flows; filter where reswell_metric_seed is not true",
    },
  })

  return {
    result: {
      metric_name: PLATFORM_ERROR_DIGEST_METRIC,
      ok: r.ok,
      skipped: r.skipped,
      status: r.status,
      skipReason: r.skipReason,
      detail: r.detail,
    },
  }
}
