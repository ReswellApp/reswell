/**
 * Sends one minimal Events API event per raffle metric so they appear under
 * Flows → Your metrics → API before real entries arrive.
 */

import "@/lib/klaviyo/bootstrap-env"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import {
  GIVEAWAY_ENTERED_METRIC,
  GIVEAWAY_LISTING_REMINDER_METRIC,
  GIVEAWAY_QUALIFIED_METRIC,
} from "@/lib/klaviyo/track-giveaway-entry"

const SEED_PROFILE_EXTERNAL_ID = "reswell-metric-seed-giveaway"

export type BootstrapGiveawayMetricResult = {
  metric_name: string
  ok: boolean
  skipped: boolean
  status: number
  skipReason?: string
  detail: string
}

export async function bootstrapGiveawayMetrics(): Promise<{
  results: BootstrapGiveawayMetricResult[]
}> {
  const time = new Date().toISOString()
  const seeds = [
    {
      metricName: GIVEAWAY_ENTERED_METRIC,
      uniqueId: "reswell-seed-giveaway-entered",
      properties: {
        time,
        reswell_metric_seed: true,
        giveaway_slug: "win-a-custom-surfboard",
        giveaway_title: "List a surfboard to win a surfboard",
        List_URL: "https://www.reswell.app/sell/boards?new=1&from=giveaway",
        Giveaway_URL: "https://www.reswell.app/giveaways",
        next_step: "list_surfboard",
        qualified: false,
      },
    },
    {
      metricName: GIVEAWAY_QUALIFIED_METRIC,
      uniqueId: "reswell-seed-giveaway-qualified",
      properties: {
        time,
        reswell_metric_seed: true,
        giveaway_slug: "win-a-custom-surfboard",
        listing_id: "00000000-0000-0000-0000-000000000000",
        qualified: true,
        next_step: "you_are_in",
      },
    },
    {
      metricName: GIVEAWAY_LISTING_REMINDER_METRIC,
      uniqueId: "reswell-seed-giveaway-listing-reminder",
      properties: {
        time,
        reswell_metric_seed: true,
        giveaway_slug: "win-a-custom-surfboard",
        List_URL: "https://www.reswell.app/sell/boards?new=1&from=giveaway",
        "Needs listing nudge": true,
        next_step: "list_surfboard",
        qualified: false,
      },
    },
  ] as const

  const results: BootstrapGiveawayMetricResult[] = []
  for (const seed of seeds) {
    const r = await sendKlaviyoServerEvent({
      metricName: seed.metricName,
      profile: { external_id: SEED_PROFILE_EXTERNAL_ID },
      uniqueId: seed.uniqueId,
      properties: seed.properties,
    })
    results.push({
      metric_name: seed.metricName,
      ok: r.ok,
      skipped: r.skipped,
      status: r.status,
      skipReason: r.skipReason,
      detail: r.detail,
    })
  }

  return { results }
}
