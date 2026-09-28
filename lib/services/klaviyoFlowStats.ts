/**
 * Pulls Klaviyo flow series (and a small set of metric aggregates) into Supabase
 * so the notifications center can chart delivery without calling Klaviyo on every view.
 */

import { klaviyoGetAllPages, klaviyoWrite } from "@/lib/klaviyo/api-client"
import {
  aggregateFlowSeriesReport,
  aggregateMetricCountSeries,
  klaviyoReportTimestamp,
  type FlowSeriesReportAttributes,
} from "@/lib/klaviyo/flow-stats-shared"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  pruneKlaviyoEventLog,
  upsertKlaviyoFlowStats,
  upsertKlaviyoMetricCounts,
} from "@/lib/db/klaviyoFlowStats"

const SERIES_DAYS = 90
const METRIC_LOOKBACK_MS = 2 * 24 * 60 * 60 * 1000
const METRIC_SYNC_CAP = 25
const CONVERSION_METRIC_NAMES = ["Placed Order", "Purchase Successful"]
const COUNT_STATISTICS = [
  "recipients",
  "delivered",
  "opens_unique",
  "clicks_unique",
  "bounced",
  "unsubscribes",
  "spam_complaints",
] as const

export class KlaviyoFlowStatsError extends Error {
  readonly status: number
  readonly missingKey: boolean
  readonly scopeHint: boolean

  constructor(
    message: string,
    opts: { status?: number; missingKey?: boolean; scopeHint?: boolean } = {},
  ) {
    super(message)
    this.name = "KlaviyoFlowStatsError"
    this.status = opts.status ?? 0
    this.missingKey = opts.missingKey ?? false
    this.scopeHint = opts.scopeHint ?? false
  }
}

export interface KlaviyoFlowPerformanceSyncResult {
  flowRows: number
  metricRows: number
  pruned: number
  warnings: string[]
}

type MetricResource = {
  id: string
  attributes?: { name?: string }
}

type MetricAggregateResponse = {
  data?: {
    attributes?: {
      dates?: string[]
      data?: { measurements?: { count?: number[] } }[]
    }
  }
}

function seriesWindow(now: Date): { start: Date; end: Date } {
  const end = new Date(now)
  end.setUTCDate(end.getUTCDate() + 1)
  end.setUTCHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - SERIES_DAYS)
  return { start, end }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function listMetricResources(): Promise<MetricResource[]> {
  const page = await klaviyoGetAllPages<MetricResource>(
    "/api/metrics/",
    { "fields[metric]": "name", "page[size]": "100" },
    { maxPages: 20 },
  )
  if (!page.ok) {
    const scopeHint = page.status === 401 || page.status === 403
    throw new KlaviyoFlowStatsError(
      page.missingKey
        ? "KLAVIYO_API_KEY not set"
        : scopeHint
          ? "Klaviyo rejected metrics — the private API key needs metrics:read."
          : `Failed to list Klaviyo metrics (${page.status}): ${page.detail}`,
      { status: page.status, missingKey: page.missingKey, scopeHint },
    )
  }
  return page.data
}

async function fetchFlowSeries(
  conversionMetricId: string,
  includeConversionValue: boolean,
  now: Date,
): Promise<FlowSeriesReportAttributes> {
  const window = seriesWindow(now)
  const statistics = includeConversionValue
    ? [...COUNT_STATISTICS, "conversion_value"]
    : [...COUNT_STATISTICS]

  const result = await klaviyoWrite<{ data?: { attributes?: FlowSeriesReportAttributes } }>(
    "POST",
    "/api/flow-series-reports/",
    {
      data: {
        type: "flow-series-report",
        attributes: {
          timeframe: {
            start: klaviyoReportTimestamp(window.start),
            end: klaviyoReportTimestamp(window.end),
          },
          interval: "daily",
          conversion_metric_id: conversionMetricId,
          statistics,
          group_by: ["flow_message_id", "flow_id", "send_channel"],
        },
      },
    },
    { maxAttempts: 3 },
  )

  if (!result.ok) {
    const scopeHint = result.status === 401 || result.status === 403
    throw new KlaviyoFlowStatsError(
      result.missingKey
        ? "KLAVIYO_API_KEY not set"
        : scopeHint
          ? "Klaviyo rejected the flow series report — the private API key needs flows:read."
          : `Klaviyo flow series failed (${result.status}): ${result.detail}`,
      { status: result.status, missingKey: result.missingKey, scopeHint },
    )
  }

  return result.data.data?.attributes ?? {}
}

async function recentSentMetricNames(
  supabase: ReturnType<typeof createServiceRoleClient>,
  now: Date,
): Promise<string[]> {
  const since = new Date(now.getTime() - METRIC_LOOKBACK_MS).toISOString()
  const { data, error } = await supabase
    .from("klaviyo_event_log")
    .select("metric_name")
    .eq("status", "sent")
    .gte("created_at", since)
    .limit(5000)

  if (error) throw new Error(error.message)
  const names = new Set<string>()
  for (const row of data ?? []) {
    const name = typeof row.metric_name === "string" ? row.metric_name.trim() : ""
    if (name) names.add(name)
  }
  return [...names].sort().slice(0, METRIC_SYNC_CAP)
}

async function fetchMetricCounts(
  metric: MetricResource,
  now: Date,
): Promise<ReturnType<typeof aggregateMetricCountSeries>> {
  const bounds = seriesWindow(now)
  const filterTimestamp = (date: Date) => date.toISOString().replace(/\.\d{3}Z$/, "")
  const result = await klaviyoWrite<MetricAggregateResponse>(
    "POST",
    "/api/metric-aggregates/",
    {
      data: {
        type: "metric-aggregate",
        attributes: {
          metric_id: metric.id,
          measurements: ["count"],
          interval: "day",
          timezone: "UTC",
          filter: [
            `greater-or-equal(datetime,${filterTimestamp(bounds.start)})`,
            `less-than(datetime,${filterTimestamp(bounds.end)})`,
          ],
        },
      },
    },
    { maxAttempts: 3 },
  )
  if (!result.ok) {
    throw new Error(result.detail || `Metric aggregate failed (${result.status})`)
  }
  const attributes = result.data.data?.attributes
  const name = metric.attributes?.name?.trim() || metric.id
  return aggregateMetricCountSeries({
    metricId: metric.id,
    metricName: name,
    dates: attributes?.dates ?? [],
    counts: attributes?.data?.[0]?.measurements?.count ?? [],
  })
}

/**
 * Refresh the flow performance snapshot. Metric ingest counts and log pruning
 * run from the daily cron; the admin refresh button only pulls the flow series.
 */
export async function syncKlaviyoFlowPerformance(options?: {
  metricCounts?: boolean
  pruneEventLog?: boolean
  now?: Date
}): Promise<KlaviyoFlowPerformanceSyncResult> {
  const now = options?.now ?? new Date()
  const warnings: string[] = []
  const metrics = await listMetricResources()
  if (metrics.length === 0) {
    throw new KlaviyoFlowStatsError("Klaviyo returned no metrics to use as a conversion metric.")
  }

  const conversion =
    metrics.find((metric) => CONVERSION_METRIC_NAMES.includes(metric.attributes?.name?.trim() ?? "")) ??
    metrics[0]
  if (!conversion) {
    throw new KlaviyoFlowStatsError("Klaviyo returned no metrics to use as a conversion metric.")
  }
  const conversionName = conversion.attributes?.name?.trim() ?? ""
  const includeConversionValue = CONVERSION_METRIC_NAMES.includes(conversionName)

  const attributes = await fetchFlowSeries(conversion.id, includeConversionValue, now)
  const flowRows = aggregateFlowSeriesReport(attributes)
  const fetchedAt = now.toISOString()

  let supabase: ReturnType<typeof createServiceRoleClient>
  try {
    supabase = createServiceRoleClient()
  } catch {
    throw new KlaviyoFlowStatsError("Server config: missing service role", { status: 503 })
  }

  const storedFlows = await upsertKlaviyoFlowStats(supabase, flowRows, fetchedAt)

  let storedMetrics = 0
  if (options?.metricCounts) {
    const names = await recentSentMetricNames(supabase, now)
    const byName = new Map(
      metrics
        .map((metric) => [metric.attributes?.name?.trim() ?? "", metric] as const)
        .filter(([name]) => name),
    )
    for (const name of names) {
      const metric = byName.get(name)
      if (!metric) continue
      try {
        const rows = await fetchMetricCounts(metric, now)
        storedMetrics += await upsertKlaviyoMetricCounts(supabase, rows, fetchedAt)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        warnings.push(`${name}: ${message}`)
        console.error("[klaviyo] metric aggregate failed", name, message)
      }
      await sleep(1100)
    }
  }

  let pruned = 0
  if (options?.pruneEventLog) {
    try {
      pruned = await pruneKlaviyoEventLog(supabase, now)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      warnings.push(`prune: ${message}`)
      console.error("[klaviyo] event log prune failed", message)
    }
  }

  return { flowRows: storedFlows, metricRows: storedMetrics, pruned, warnings }
}
