/**
 * Sends one minimal Events API event for the **Intelligence Report** metric so Klaviyo lists it
 * under **Flows → Your metrics → API** before any real cron dispatch.
 *
 * Uses a synthetic `external_id` and `reswell_metric_seed: true` — exclude in flows via a trigger
 * filter where `event.reswell_metric_seed` is **not true** if needed.
 *
 * Run once: `POST /api/integrations/klaviyo/bootstrap-intelligence-report`
 * with `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set.
 */

import "@/lib/klaviyo/bootstrap-env"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

/** Klaviyo metric — build a flow triggered on this name for admin digests. */
export const INTELLIGENCE_REPORT_METRIC = "Intelligence Report"

const SEED_PROFILE_EXTERNAL_ID = "reswell-metric-seed-intelligence-report"

export type BootstrapIntelligenceReportResult = {
  metric_name: string
  ok: boolean
  skipped: boolean
  status: number
  skipReason?: string
  detail: string
}

export async function bootstrapIntelligenceReport(): Promise<{
  result: BootstrapIntelligenceReportResult
}> {
  const time = new Date().toISOString()

  const r = await sendKlaviyoServerEvent({
    metricName: INTELLIGENCE_REPORT_METRIC,
    profile: {
      external_id: SEED_PROFILE_EXTERNAL_ID,
    },
    uniqueId: "reswell-seed-intelligence-report",
    properties: {
      time,
      reswell_metric_seed: true,
      period_kind: "daily",
      period_key: "1970-01-01",
      period_start: "1970-01-01",
      period_end: "1970-01-01",
      generated_at: time,
      model: "seed",
      executive_summary: "Seed event — ignore in flows; filter where reswell_metric_seed is not true",
      period_recap: "",
      recommendations: [],
      risks: [],
      opportunities: [],
      watch_next_period: [],
      dashboard_url: "/admin/intelligence",
    },
  })

  return {
    result: {
      metric_name: INTELLIGENCE_REPORT_METRIC,
      ok: r.ok,
      skipped: r.skipped,
      status: r.status,
      skipReason: r.skipReason,
      detail: r.detail,
    },
  }
}
