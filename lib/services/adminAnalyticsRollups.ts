import {
  listPendingAdminAnalyticsRollupDays,
  pruneAdminAnalyticsRawBatch,
  refreshAdminAnalyticsRollupDay,
} from "@/lib/db/adminAnalyticsRollups"
import {
  runAdminAnalyticsRollupsWithStore,
  type AdminAnalyticsRollupRun,
} from "@/lib/services/adminAnalyticsRollupsPolicy"
import { createServiceRoleClient } from "@/lib/supabase/server"

export type { AdminAnalyticsRollupRun }

export async function runAdminAnalyticsRollups(
  now = new Date(),
  options: { pruneRaw?: boolean } = {},
): Promise<AdminAnalyticsRollupRun> {
  const supabase = createServiceRoleClient()
  return runAdminAnalyticsRollupsWithStore(
    {
      listPendingDays: (source, limit) =>
        listPendingAdminAnalyticsRollupDays(supabase, source, limit),
      refreshDay: (source, rollupDate) =>
        refreshAdminAnalyticsRollupDay(supabase, source, rollupDate),
      pruneRawBatch: (source, before, limit) =>
        pruneAdminAnalyticsRawBatch(supabase, source, before, limit),
    },
    now,
    options,
  )
}
