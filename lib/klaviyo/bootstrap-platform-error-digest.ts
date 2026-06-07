/**
 * Sends one minimal Events API event for the **Platform Error Digest** metric so Klaviyo lists it
 * under **Flows → Your metrics → API** before any real error batch is dispatched.
 *
 * Uses a synthetic `external_id` and `reswell_metric_seed: true` — exclude in flows via a trigger
 * filter where `event.reswell_metric_seed` is **not true** if needed.
 *
 * Run once: `POST /api/integrations/klaviyo/bootstrap-platform-error-digest`
 * with `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set.
 */

import "@/lib/klaviyo/bootstrap-env"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

export const PLATFORM_ERROR_DIGEST_METRIC_NAME = "Platform Error Digest"

const SEED_PROFILE_EXTERNAL_ID = "reswell-metric-seed-platform-error-digest"

export type BootstrapPlatformErrorDigestResult = {
  metric_name: string
  ok: boolean
  skipped: boolean
  status: number
  skipReason?: string
  detail: string
}

export async function bootstrapPlatformErrorDigest(): Promise<{
  result: BootstrapPlatformErrorDigestResult
}> {
  const time = new Date().toISOString()

  const r = await sendKlaviyoServerEvent({
    metricName: PLATFORM_ERROR_DIGEST_METRIC_NAME,
    profile: {
      external_id: SEED_PROFILE_EXTERNAL_ID,
    },
    uniqueId: "reswell-seed-platform-error-digest",
    properties: {
      time,
      reswell_metric_seed: true,
      error_count: 0,
      period_start: time,
      period_end: time,
      errors: [],
    },
  })

  return {
    result: {
      metric_name: PLATFORM_ERROR_DIGEST_METRIC_NAME,
      ok: r.ok,
      skipped: r.skipped,
      status: r.status,
      skipReason: r.skipReason,
      detail: r.detail,
    },
  }
}
