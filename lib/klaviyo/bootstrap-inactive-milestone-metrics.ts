/**
 * Sends one minimal Events API event so **User Inactive 30 Days** appears under
 * **Flows → Your metrics → API** before any real user qualifies for cron.
 *
 * Uses a synthetic `external_id` and `reswell_metric_seed` on events — exclude in flows via
 * a trigger filter where `event.reswell_metric_seed` is **not true** if needed.
 */

import "@/lib/klaviyo/bootstrap-env"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import {
  KLAVIYO_USER_INACTIVE_MILESTONE_DAYS,
  USER_INACTIVE_30_DAYS_METRIC,
} from "@/lib/klaviyo/track-user-inactive-milestone"

const SEED_PROFILE_EXTERNAL_ID = "reswell-metric-seed-inactive"

export type BootstrapInactiveMilestoneMetricResult = {
  milestone_days: typeof KLAVIYO_USER_INACTIVE_MILESTONE_DAYS
  metric_name: string
  ok: boolean
  skipped: boolean
  status: number
  skipReason?: string
  detail: string
}

export async function bootstrapInactiveMilestoneMetrics(): Promise<{
  results: BootstrapInactiveMilestoneMetricResult[]
}> {
  const time = new Date().toISOString()
  const r = await sendKlaviyoServerEvent({
    metricName: USER_INACTIVE_30_DAYS_METRIC,
    profile: {
      external_id: SEED_PROFILE_EXTERNAL_ID,
    },
    uniqueId: "reswell-seed-inactive-30d",
    properties: {
      time,
      reswell_metric_seed: true,
      inactive_milestone_days: KLAVIYO_USER_INACTIVE_MILESTONE_DAYS,
    },
  })

  return {
    results: [
      {
        milestone_days: KLAVIYO_USER_INACTIVE_MILESTONE_DAYS,
        metric_name: USER_INACTIVE_30_DAYS_METRIC,
        ok: r.ok,
        skipped: r.skipped,
        status: r.status,
        skipReason: r.skipReason,
        detail: r.detail,
      },
    ],
  }
}
