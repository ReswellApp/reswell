/** Client-safe types for the Klaviyo flow performance snapshot. */

import {
  NOTIFICATIONS_CENTER_RANGE_HOURS,
  type NotificationsCenterRange,
} from "@/lib/klaviyo/event-log-shared"

export interface KlaviyoFlowChannelStats {
  flowId: string
  channel: string
  recipients: number
  delivered: number
  opens: number
  clicks: number
  bounces: number
  unsubscribes: number
  spamComplaints: number
  conversionValue: number
}

export interface KlaviyoMetricIngestRow {
  metric: string
  count: number
}

export interface KlaviyoFlowPerformance {
  range: NotificationsCenterRange
  since: string
  until: string
  fetchedAt: string | null
  byFlow: KlaviyoFlowChannelStats[]
  byMetric: KlaviyoMetricIngestRow[]
}

export interface KlaviyoFlowStatDailyRow {
  flowId: string
  sendChannel: string
  statDate: string
  recipients: number
  delivered: number
  opens: number
  clicks: number
  bounces: number
  unsubscribes: number
  spamComplaints: number
  conversionValue: number
}

export interface KlaviyoMetricCountDailyRow {
  metricId: string
  metricName: string
  statDate: string
  eventCount: number
}

interface FlowSeriesGroup {
  groupings?: {
    flow_id?: string
    send_channel?: string
    flow_message_id?: string
  }
  statistics?: Record<string, unknown>
}

export interface FlowSeriesReportAttributes {
  results?: FlowSeriesGroup[]
  date_times?: string[]
}

/** UTC dates overlapping a rolling window. `until` is exclusive. */
export function performanceDateWindow(
  range: NotificationsCenterRange,
  now = new Date(),
): { since: string; until: string } {
  const hours = NOTIFICATIONS_CENTER_RANGE_HOURS[range]
  const sinceDate = new Date(now.getTime() - hours * 60 * 60 * 1000)
  const until = new Date(now)
  until.setUTCDate(until.getUTCDate() + 1)
  return {
    since: sinceDate.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
  }
}

export function klaviyoReportTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "+00:00")
}

function statAt(stats: Record<string, unknown> | undefined, key: string, index: number): number {
  const series = stats?.[key]
  if (!Array.isArray(series)) return 0
  const value = Number(series[index])
  return Number.isFinite(value) ? value : 0
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Collapse a flow series report (grouped by message) into one row per flow, channel, and day.
 * Opens and clicks use Klaviyo's unique-per-day statistics.
 */
export function aggregateFlowSeriesReport(
  attributes: FlowSeriesReportAttributes | null | undefined,
): KlaviyoFlowStatDailyRow[] {
  const dates = attributes?.date_times ?? []
  const totals = new Map<string, KlaviyoFlowStatDailyRow>()

  for (const group of attributes?.results ?? []) {
    const flowId = group.groupings?.flow_id?.trim()
    const channel = group.groupings?.send_channel?.trim() || "email"
    if (!flowId) continue

    for (let index = 0; index < dates.length; index += 1) {
      const statDate = dates[index]?.slice(0, 10)
      if (!statDate) continue
      const key = `${flowId}|${channel}|${statDate}`
      const existing = totals.get(key) ?? {
        flowId,
        sendChannel: channel,
        statDate,
        recipients: 0,
        delivered: 0,
        opens: 0,
        clicks: 0,
        bounces: 0,
        unsubscribes: 0,
        spamComplaints: 0,
        conversionValue: 0,
      }
      existing.recipients += statAt(group.statistics, "recipients", index)
      existing.delivered += statAt(group.statistics, "delivered", index)
      existing.opens += statAt(group.statistics, "opens_unique", index)
      existing.clicks += statAt(group.statistics, "clicks_unique", index)
      existing.bounces += statAt(group.statistics, "bounced", index)
      existing.unsubscribes += statAt(group.statistics, "unsubscribes", index)
      existing.spamComplaints += statAt(group.statistics, "spam_complaints", index)
      existing.conversionValue = roundMoney(
        existing.conversionValue + statAt(group.statistics, "conversion_value", index),
      )
      totals.set(key, existing)
    }
  }

  return [...totals.values()]
}

export function aggregateMetricCountSeries(input: {
  metricId: string
  metricName: string
  dates: readonly string[]
  counts: readonly unknown[]
}): KlaviyoMetricCountDailyRow[] {
  const rows: KlaviyoMetricCountDailyRow[] = []
  for (let index = 0; index < input.dates.length; index += 1) {
    const statDate = input.dates[index]?.slice(0, 10)
    if (!statDate) continue
    const count = Number(input.counts[index])
    rows.push({
      metricId: input.metricId,
      metricName: input.metricName,
      statDate,
      eventCount: Number.isFinite(count) ? Math.round(count) : 0,
    })
  }
  return rows
}
