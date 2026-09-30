import type { AdminAnalyticsRollupSource } from "@/lib/db/adminAnalyticsRollups"

const DAY_MS = 24 * 60 * 60 * 1000

export const ADMIN_ANALYTICS_RETENTION_DAYS: Record<
  AdminAnalyticsRollupSource,
  number
> = {
  site_traffic: 45,
  klaviyo_event_log: 90,
}

export function analyticsRetentionCutoff(
  source: AdminAnalyticsRollupSource,
  now: Date,
): string {
  return new Date(
    now.getTime() - ADMIN_ANALYTICS_RETENTION_DAYS[source] * DAY_MS,
  ).toISOString()
}
