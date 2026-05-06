/**
 * Sends one minimal Events API event per inactive-milestone metric so Klaviyo lists them under
 * **Flows → Your metrics → API** before any real user qualifies for cron.
 *
 * Uses a synthetic `external_id` and `reswell_metric_seed` on events — exclude in flows via
 * a trigger filter where `event.reswell_metric_seed` is **not true** if needed.
 */

import "@/lib/klaviyo/bootstrap-env"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import {
  INACTIVE_MILESTONE_METRIC_NAMES,
  type KlaviyoUserInactiveMilestoneDays,
} from "@/lib/klaviyo/track-user-inactive-milestone"

const SEED_PROFILE_EXTERNAL_ID = "reswell-metric-seed-inactive"

const DAYS: KlaviyoUserInactiveMilestoneDays[] = [3, 15, 30]

export type BootstrapInactiveMilestoneMetricResult = {
  milestone_days: KlaviyoUserInactiveMilestoneDays
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
  const results: BootstrapInactiveMilestoneMetricResult[] = []

  for (const days of DAYS) {
    const metric_name = INACTIVE_MILESTONE_METRIC_NAMES[days]
    const r = await sendKlaviyoServerEvent({
      metricName: metric_name,
      profile: {
        external_id: SEED_PROFILE_EXTERNAL_ID,
      },
      uniqueId: `reswell-seed-inactive-${days}d`,
      properties: {
        time,
        reswell_metric_seed: true,
        inactive_milestone_days: days,
      },
    })

    results.push({
      milestone_days: days,
      metric_name,
      ok: r.ok,
      skipped: r.skipped,
      status: r.status,
      skipReason: r.skipReason,
      detail: r.detail,
    })
  }

  return { results }
}
