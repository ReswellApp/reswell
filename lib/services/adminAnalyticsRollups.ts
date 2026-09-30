import {
  ADMIN_ANALYTICS_ROLLUP_SOURCES,
  listPendingAdminAnalyticsRollupDays,
  pruneAdminAnalyticsRawBatch,
  refreshAdminAnalyticsRollupDay,
  type AdminAnalyticsRollupResult,
  type AdminAnalyticsRollupSource,
} from "@/lib/db/adminAnalyticsRollups"
import { analyticsRetentionCutoff } from "@/lib/analytics/admin-rollup-policy"
import { createServiceRoleClient } from "@/lib/supabase/server"

const BACKFILL_DAYS_PER_SOURCE = 3
const PRUNE_BATCH_SIZE = 10_000
const PRUNE_BATCHES_PER_SOURCE = 10

export interface AdminAnalyticsRollupRun {
  rolledUp: AdminAnalyticsRollupResult[]
  pruningEnabled: boolean
  pruned: Record<AdminAnalyticsRollupSource, number>
  pruneLimitReached: AdminAnalyticsRollupSource[]
}

export async function runAdminAnalyticsRollups(
  now = new Date(),
  options: { pruneRaw?: boolean } = {},
): Promise<AdminAnalyticsRollupRun> {
  const supabase = createServiceRoleClient()
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
    const dates = await listPendingAdminAnalyticsRollupDays(
      supabase,
      source,
      BACKFILL_DAYS_PER_SOURCE,
    )
    for (const rollupDate of dates) {
      rolledUp.push(
        await refreshAdminAnalyticsRollupDay(supabase, source, rollupDate),
      )
    }
  }

  // Raw retention is deliberately opt-in. Enable it only after historical
  // backfill and dashboard parity validation are complete. SQL independently
  // requires coverage and every enabled run remains bounded.
  if (pruningEnabled) {
    for (const source of ADMIN_ANALYTICS_ROLLUP_SOURCES) {
      const before = analyticsRetentionCutoff(source, now)
      for (let batch = 0; batch < PRUNE_BATCHES_PER_SOURCE; batch += 1) {
        const deleted = await pruneAdminAnalyticsRawBatch(
          supabase,
          source,
          before,
          PRUNE_BATCH_SIZE,
        )
        pruned[source] += deleted
        if (deleted < PRUNE_BATCH_SIZE) break
        if (batch === PRUNE_BATCHES_PER_SOURCE - 1) {
          pruneLimitReached.push(source)
        }
      }
    }
  }

  return { rolledUp, pruningEnabled, pruned, pruneLimitReached }
}
