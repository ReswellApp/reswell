import type { SupabaseClient } from "@supabase/supabase-js"

export const ADMIN_ANALYTICS_ROLLUP_SOURCES = [
  "site_traffic",
  "klaviyo_event_log",
] as const

export type AdminAnalyticsRollupSource =
  (typeof ADMIN_ANALYTICS_ROLLUP_SOURCES)[number]

export interface AdminAnalyticsRollupResult {
  source: AdminAnalyticsRollupSource
  rollupDate: string
  sourceRows: number
}

function toNonNegativeInteger(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Invalid analytics rollup result")
  }
  return Math.trunc(parsed)
}

export async function listPendingAdminAnalyticsRollupDays(
  supabase: SupabaseClient,
  source: AdminAnalyticsRollupSource,
  limit: number,
): Promise<string[]> {
  const { data, error } = await supabase.rpc("next_admin_analytics_rollup_days", {
    p_source: source,
    p_limit: limit,
  })
  if (error) throw new Error(error.message)

  return (data ?? []).map((row: Record<string, unknown>) => {
    const value = row.rollup_date
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error("Invalid analytics rollup date")
    }
    return value
  })
}

export async function refreshAdminAnalyticsRollupDay(
  supabase: SupabaseClient,
  source: AdminAnalyticsRollupSource,
  rollupDate: string,
): Promise<AdminAnalyticsRollupResult> {
  const { data, error } = await supabase.rpc("refresh_admin_analytics_rollup_day", {
    p_source: source,
    p_date: rollupDate,
  })
  if (error) throw new Error(error.message)

  const raw = (data ?? {}) as Record<string, unknown>
  if (raw.source !== source || raw.rollupDate !== rollupDate) {
    throw new Error("Invalid analytics rollup response")
  }

  return {
    source,
    rollupDate,
    sourceRows: toNonNegativeInteger(raw.sourceRows),
  }
}

export async function pruneAdminAnalyticsRawBatch(
  supabase: SupabaseClient,
  source: AdminAnalyticsRollupSource,
  before: string,
  limit: number,
): Promise<number> {
  const { data, error } = await supabase.rpc("prune_admin_analytics_raw", {
    p_source: source,
    p_before: before,
    p_limit: limit,
  })
  if (error) throw new Error(error.message)
  return toNonNegativeInteger(data)
}
