import type { SupabaseClient } from "@supabase/supabase-js"

import { pruneAdminAnalyticsRawBatch } from "@/lib/db/adminAnalyticsRollups"
import type { NotificationsCenterRange } from "@/lib/klaviyo/event-log-shared"
import {
  performanceDateWindow,
  type KlaviyoFlowChannelStats,
  type KlaviyoFlowPerformance,
  type KlaviyoFlowStatDailyRow,
  type KlaviyoMetricCountDailyRow,
  type KlaviyoMetricIngestRow,
} from "@/lib/klaviyo/flow-stats-shared"

function toNum(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : []
}

/**
 * Summed flow performance for the admin window.
 * `supabase` must be an authenticated staff client (RPC gate enforces staff).
 */
export async function fetchKlaviyoFlowPerformance(
  supabase: SupabaseClient,
  range: NotificationsCenterRange,
  now = new Date(),
): Promise<KlaviyoFlowPerformance> {
  const window = performanceDateWindow(range, now)
  const { data, error } = await supabase.rpc("klaviyo_flow_performance", {
    p_since: window.since,
    p_until: window.until,
  })
  if (error) throw new Error(error.message)

  const payload = (data ?? {}) as Record<string, unknown>
  const byFlow: KlaviyoFlowChannelStats[] = asRecordArray(payload.byFlow).map((row) => ({
    flowId: String(row.flowId ?? ""),
    channel: String(row.channel ?? ""),
    recipients: toNum(row.recipients),
    delivered: toNum(row.delivered),
    opens: toNum(row.opens),
    clicks: toNum(row.clicks),
    bounces: toNum(row.bounces),
    unsubscribes: toNum(row.unsubscribes),
    spamComplaints: toNum(row.spamComplaints),
    conversionValue: toNum(row.conversionValue),
  }))
  const byMetric: KlaviyoMetricIngestRow[] = asRecordArray(payload.byMetric).map((row) => ({
    metric: String(row.metric ?? ""),
    count: toNum(row.count),
  }))

  return {
    range,
    since: window.since,
    until: window.until,
    fetchedAt: typeof payload.fetchedAt === "string" ? payload.fetchedAt : null,
    byFlow: byFlow.filter((row) => row.flowId),
    byMetric: byMetric.filter((row) => row.metric),
  }
}

async function upsertChunks(
  supabase: SupabaseClient,
  table: "klaviyo_flow_stats_daily" | "klaviyo_metric_counts_daily",
  rows: Record<string, unknown>[],
  onConflict: string,
): Promise<void> {
  const size = 400
  for (let index = 0; index < rows.length; index += size) {
    const chunk = rows.slice(index, index + size)
    const { error } = await supabase.from(table).upsert(chunk, { onConflict })
    if (error) throw new Error(error.message)
  }
}

export async function upsertKlaviyoFlowStats(
  supabase: SupabaseClient,
  rows: KlaviyoFlowStatDailyRow[],
  fetchedAt: string,
): Promise<number> {
  if (rows.length === 0) return 0
  await upsertChunks(
    supabase,
    "klaviyo_flow_stats_daily",
    rows.map((row) => ({
      flow_id: row.flowId,
      send_channel: row.sendChannel,
      stat_date: row.statDate,
      recipients: Math.round(row.recipients),
      delivered: Math.round(row.delivered),
      opens: Math.round(row.opens),
      clicks: Math.round(row.clicks),
      bounces: Math.round(row.bounces),
      unsubscribes: Math.round(row.unsubscribes),
      spam_complaints: Math.round(row.spamComplaints),
      conversion_value: row.conversionValue,
      fetched_at: fetchedAt,
    })),
    "flow_id,send_channel,stat_date",
  )
  return rows.length
}

export async function upsertKlaviyoMetricCounts(
  supabase: SupabaseClient,
  rows: KlaviyoMetricCountDailyRow[],
  fetchedAt: string,
): Promise<number> {
  if (rows.length === 0) return 0
  await upsertChunks(
    supabase,
    "klaviyo_metric_counts_daily",
    rows.map((row) => ({
      metric_id: row.metricId,
      metric_name: row.metricName,
      stat_date: row.statDate,
      event_count: row.eventCount,
      fetched_at: fetchedAt,
    })),
    "metric_id,stat_date",
  )
  return rows.length
}

const EVENT_LOG_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
const PRUNE_BATCH = 10_000
const PRUNE_BATCHES = 10

/**
 * Deletes up to 100k event-log rows older than 90 days. The database only
 * removes rows whose complete UTC date has proven rollup coverage.
 */
export async function pruneKlaviyoEventLog(supabase: SupabaseClient, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - EVENT_LOG_RETENTION_MS).toISOString()
  let deleted = 0

  for (let batch = 0; batch < PRUNE_BATCHES; batch += 1) {
    const removed = await pruneAdminAnalyticsRawBatch(
      supabase,
      "klaviyo_event_log",
      cutoff,
      PRUNE_BATCH,
    )
    deleted += removed
    if (removed < PRUNE_BATCH) break
  }

  return deleted
}
