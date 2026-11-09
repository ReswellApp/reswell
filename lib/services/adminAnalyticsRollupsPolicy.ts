import {
  ADMIN_ANALYTICS_ROLLUP_SOURCES,
  type AdminAnalyticsRollupResult,
  type AdminAnalyticsRollupSource,
} from "@/lib/db/adminAnalyticsRollups"
import { analyticsRetentionCutoff } from "@/lib/analytics/admin-rollup-policy"

export const ADMIN_ANALYTICS_BACKFILL_DAYS_PER_SOURCE = 3
export const ADMIN_ANALYTICS_PRUNE_BATCH_SIZE = 10_000
export const ADMIN_ANALYTICS_PRUNE_BATCHES_PER_SOURCE = 10

export interface AdminAnalyticsRollupRun {
  rolledUp: AdminAnalyticsRollupResult[]
  pruningEnabled: boolean
  pruned: Record<AdminAnalyticsRollupSource, number>
  pruneLimitReached: AdminAnalyticsRollupSource[]
}

export interface AdminAnalyticsRollupStore {
  listPendingDays: (
    source: AdminAnalyticsRollupSource,
    limit: number,
  ) => Promise<string[]>
  refreshDay: (
    source: AdminAnalyticsRollupSource,
    rollupDate: string,
  ) => Promise<AdminAnalyticsRollupResult>
  pruneRawBatch: (
    source: AdminAnalyticsRollupSource,
    before: string,
    limit: number,
  ) => Promise<number>
}

export async function runAdminAnalyticsRollupsWithStore(
  store: AdminAnalyticsRollupStore,
  now = new Date(),
  options: { pruneRaw?: boolean } = {},
): Promise<AdminAnalyticsRollupRun> {
  const pruningEnabled = options.pruneRaw === true
  const rolledUp: AdminAnalyticsRollupResult[] = []
  const pruned: Record<AdminAnalyticsRollupSource, number> = {
    site_traffic: 0,
    klaviyo_event_log: 0,
  }
  const pruneLimitReached: AdminAnalyticsRollupSource[] = []

  // Each refresh is a separate RPC transaction. Never combine historical dates
  // into one production transaction.
  for (const source of ADMIN_ANALYTICS_ROLLUP_SOURCES) {
    const dates = await store.listPendingDays(
      source,
      ADMIN_ANALYTICS_BACKFILL_DAYS_PER_SOURCE,
    )
    for (const rollupDate of dates) {
      rolledUp.push(await store.refreshDay(source, rollupDate))
    }
  }

  // Raw retention is deliberately opt-in. Enable it only after historical
  // backfill and dashboard parity validation are complete. SQL independently
  // requires coverage and every enabled run remains bounded.
  if (pruningEnabled) {
    for (const source of ADMIN_ANALYTICS_ROLLUP_SOURCES) {
      const before = analyticsRetentionCutoff(source, now)
      for (let batch = 0; batch < ADMIN_ANALYTICS_PRUNE_BATCHES_PER_SOURCE; batch += 1) {
        const deleted = await store.pruneRawBatch(
          source,
          before,
          ADMIN_ANALYTICS_PRUNE_BATCH_SIZE,
        )
        pruned[source] += deleted
        if (deleted < ADMIN_ANALYTICS_PRUNE_BATCH_SIZE) break
        if (batch === ADMIN_ANALYTICS_PRUNE_BATCHES_PER_SOURCE - 1) {
          pruneLimitReached.push(source)
        }
      }
    }
  }

  return { rolledUp, pruningEnabled, pruned, pruneLimitReached }
}
