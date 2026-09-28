"use client"

import { useMemo, useState } from "react"
import { formatDistanceToNow, parseISO } from "date-fns"
import { ExternalLink, Loader2, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { KNOWN_KLAVIYO_METRIC_NAMES } from "@/lib/klaviyo/event-log-shared"
import {
  KLAVIYO_FLOW_DIRECTORY_FILTERS,
  flowMatchesDirectoryFilter,
  isUnmappedKlaviyoFlow,
  klaviyoFlowEditorUrl,
  type KlaviyoFlowCoverageResult,
  type KlaviyoFlowDirectoryFilter,
  type KlaviyoFlowDirectoryRow,
} from "@/lib/klaviyo/flow-coverage-shared"
import type { KlaviyoFlowChannelStats, KlaviyoFlowPerformance } from "@/lib/klaviyo/flow-stats-shared"
import { cn } from "@/lib/utils"

import { formatMoney, formatRate } from "./format"

interface FlowsTabProps {
  coverage: KlaviyoFlowCoverageResult | null
  coverageLoading: boolean
  coverageRefreshing: boolean
  coverageError: string | null
  onRefreshCoverage: () => void
  stats: KlaviyoFlowPerformance | null
  statsLoading: boolean
  statsRefreshing: boolean
  statsError: string | null
  onRefreshStats: () => void
  metricFocus: string | null
  onClearMetricFocus: () => void
  onOpenEventLog: (metric: string) => void
}

function channelStats(rows: KlaviyoFlowChannelStats[], flowId: string): KlaviyoFlowChannelStats[] {
  return rows.filter((row) => row.flowId === flowId)
}

function sumStat(
  rows: KlaviyoFlowChannelStats[],
  key: "recipients" | "delivered" | "opens" | "clicks" | "bounces" | "unsubscribes" | "spamComplaints" | "conversionValue",
): number {
  return rows.reduce((total, row) => total + row[key], 0)
}

function statusClass(status: string): string {
  if (status === "live") return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
  if (status === "draft" || status === "manual") return "bg-amber-100 text-amber-700 hover:bg-amber-100"
  return "bg-neutral-100 text-neutral-600 hover:bg-neutral-100"
}

export function FlowsTab({
  coverage,
  coverageLoading,
  coverageRefreshing,
  coverageError,
  onRefreshCoverage,
  stats,
  statsLoading,
  statsRefreshing,
  statsError,
  onRefreshStats,
  metricFocus,
  onClearMetricFocus,
  onOpenEventLog,
}: FlowsTabProps) {
  const [filter, setFilter] = useState<KlaviyoFlowDirectoryFilter>("all")
  const rows = useMemo(() => {
    return (coverage?.flows ?? []).filter((row) =>
      flowMatchesDirectoryFilter(row, filter, KNOWN_KLAVIYO_METRIC_NAMES, metricFocus),
    )
  }, [coverage?.flows, filter, metricFocus])

  const performance = stats?.byFlow ?? []
  const delivered = sumStat(performance, "delivered")
  const opens = sumStat(performance, "opens")
  const clicks = sumStat(performance, "clicks")
  const totals = coverage?.flowTotals

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Klaviyo flows</CardTitle>
            <p className="text-xs text-muted-foreground font-normal mt-1">
              Every flow in the account, separate from the metrics we emit. Performance is a daily
              Klaviyo snapshot. Opens and clicks are unique per day, summed across that window.
              {coverage?.fetchedAt
                ? ` Structure ${formatDistanceToNow(parseISO(coverage.fetchedAt), { addSuffix: true })}.`
                : null}
              {stats?.fetchedAt
                ? ` Performance ${formatDistanceToNow(parseISO(stats.fetchedAt), { addSuffix: true })}.`
                : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefreshCoverage}
              disabled={coverageRefreshing || coverageLoading}
            >
              {coverageRefreshing || coverageLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Refresh flows</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefreshStats}
              disabled={statsRefreshing || statsLoading}
            >
              {statsRefreshing || statsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Refresh performance</span>
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FlowKpi label="Live" value={totals?.live ?? "—"} hint={`${totals?.draftOrManual ?? 0} draft or manual`} />
          <FlowKpi label="Delivered" value={stats ? delivered : "—"} hint={`${formatRate(opens, delivered)} unique open rate`} />
          <FlowKpi label="Clicks" value={stats ? clicks : "—"} hint={`${formatRate(clicks, delivered)} of delivered`} />
          <FlowKpi
            label="Gaps"
            value={totals ? totals.unmapped + (coverage?.totals.noFlow ?? 0) : "—"}
            hint={`${coverage?.totals.noFlow ?? 0} metrics with no flow · ${totals?.unmapped ?? 0} unmapped flows`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap rounded-lg border border-border bg-muted/40 p-0.5">
            {KLAVIYO_FLOW_DIRECTORY_FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  filter === item.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          {metricFocus ? (
            <button
              type="button"
              onClick={onClearMetricFocus}
              className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Trigger: {metricFocus} ×
            </button>
          ) : null}
        </div>
        {coverageError ? (
          <p className="text-xs text-destructive" role="alert">
            {coverageError}
          </p>
        ) : null}
        {statsError ? (
          <p className="text-xs text-destructive" role="alert">
            {statsError}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {coverageLoading && !coverage ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading flows…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No flows match this filter.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Flow</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Trigger</th>
                <th className="pb-2 pr-4 font-medium">Channels</th>
                <th className="pb-2 pr-4 text-right font-medium">Delivered</th>
                <th className="pb-2 pr-4 text-right font-medium">Opens</th>
                <th className="pb-2 pr-4 text-right font-medium">Clicks</th>
                <th className="pb-2 pr-4 text-right font-medium">Bounces</th>
                <th className="pb-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <FlowRow
                  key={row.id}
                  row={row}
                  stats={channelStats(performance, row.id)}
                  statsReady={stats != null}
                  onOpenEventLog={onOpenEventLog}
                />
              ))}
            </tbody>
          </table>
        )}
        {stats && stats.fetchedAt == null ? (
          <p className="pt-4 text-xs text-muted-foreground">
            No performance snapshot yet. Refresh performance to pull the last 90 days from Klaviyo.
            A daily job keeps it current after that.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function FlowKpi({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function FlowRow({
  row,
  stats,
  statsReady,
  onOpenEventLog,
}: {
  row: KlaviyoFlowDirectoryRow
  stats: KlaviyoFlowChannelStats[]
  statsReady: boolean
  onOpenEventLog: (metric: string) => void
}) {
  const delivered = sumStat(stats, "delivered")
  const opens = sumStat(stats, "opens")
  const clicks = sumStat(stats, "clicks")
  const bounces = sumStat(stats, "bounces")
  const revenue = sumStat(stats, "conversionValue")
  const unmapped = isUnmappedKlaviyoFlow(row, KNOWN_KLAVIYO_METRIC_NAMES)
  const channelHint = stats
    .map((stat) => `${stat.channel} ${stat.delivered} delivered`)
    .join(" · ")

  return (
    <tr className="border-b border-border/60 last:border-0 align-top">
      <td className="py-2 pr-4">
        <a
          href={klaviyoFlowEditorUrl(row.id)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium hover:underline"
        >
          {row.name}
          <ExternalLink className="h-3 w-3 text-muted-foreground" />
        </a>
        {channelHint ? <p className="text-xs text-muted-foreground mt-0.5">{channelHint}</p> : null}
      </td>
      <td className="py-2 pr-4">
        <Badge variant="secondary" className={cn("capitalize", statusClass(row.status))}>
          {row.status || "unknown"}
        </Badge>
      </td>
      <td className="py-2 pr-4">
        {row.triggerKind === "metric" && row.triggerMetrics.length > 0 ? (
          <div className="flex flex-col items-start gap-1">
            {row.triggerMetrics.map((metric) => (
              <button
                key={metric}
                type="button"
                className="text-left hover:underline"
                onClick={() => onOpenEventLog(metric)}
              >
                {metric}
              </button>
            ))}
            {unmapped ? <span className="text-xs text-amber-700">Not emitted by Reswell</span> : null}
          </div>
        ) : (
          <span className="text-muted-foreground">
            {row.triggerLabel}
            {unmapped ? (
              <span className="block text-xs text-amber-700">Not emitted by Reswell</span>
            ) : null}
          </span>
        )}
      </td>
      <td className="py-2 pr-4 text-xs">
        {row.hasEmail == null && row.hasSms == null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span>
            {row.hasEmail ? "Email" : null}
            {row.hasEmail && row.hasSms ? " · " : null}
            {row.hasSms ? "SMS" : null}
            {!row.hasEmail && !row.hasSms ? "None" : null}
          </span>
        )}
      </td>
      <td className="py-2 pr-4 text-right tabular-nums">{statsReady ? delivered : "—"}</td>
      <td className="py-2 pr-4 text-right tabular-nums">
        {statsReady ? opens : "—"}
        {statsReady && delivered > 0 ? (
          <span className="block text-xs text-muted-foreground">{formatRate(opens, delivered)}</span>
        ) : null}
      </td>
      <td className="py-2 pr-4 text-right tabular-nums">
        {statsReady ? clicks : "—"}
        {statsReady && delivered > 0 ? (
          <span className="block text-xs text-muted-foreground">{formatRate(clicks, delivered)}</span>
        ) : null}
      </td>
      <td className="py-2 pr-4 text-right tabular-nums">{statsReady ? bounces : "—"}</td>
      <td className="py-2 text-right tabular-nums">{statsReady ? formatMoney(revenue) : "—"}</td>
    </tr>
  )
}
