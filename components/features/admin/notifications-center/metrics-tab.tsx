import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { KlaviyoFlowCoverageMetricRow } from "@/lib/klaviyo/flow-coverage-shared"
import type {
  KlaviyoMetricCategory,
  KlaviyoMetricRow,
  KlaviyoSkipReasonByMetricRow,
} from "@/lib/klaviyo/event-log-shared"
import { cn } from "@/lib/utils"

import { formatPct } from "./format"

const CATEGORY_STYLES: Record<KlaviyoMetricCategory, string> = {
  transactional: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  lifecycle: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  engagement: "bg-violet-100 text-violet-700 hover:bg-violet-100",
  marketing: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  other: "bg-neutral-100 text-neutral-600 hover:bg-neutral-100",
}

interface MetricsTabProps {
  metrics: KlaviyoMetricRow[]
  coverageByMetric: Map<string, KlaviyoFlowCoverageMetricRow>
  coverageLoading: boolean
  skipByMetric: KlaviyoSkipReasonByMetricRow[]
  klaviyoCounts: Map<string, number>
  categoryLabel: string
  onOpenEventLog: (metric: string) => void
  onOpenFlows: (metric: string) => void
}

function topSkipReason(
  metric: string,
  rows: KlaviyoSkipReasonByMetricRow[],
): KlaviyoSkipReasonByMetricRow | null {
  let best: KlaviyoSkipReasonByMetricRow | null = null
  for (const row of rows) {
    if (row.metric !== metric) continue
    if (!best || row.count > best.count) best = row
  }
  return best
}

export function MetricsTab({
  metrics,
  coverageByMetric,
  coverageLoading,
  skipByMetric,
  klaviyoCounts,
  categoryLabel,
  onOpenEventLog,
  onOpenFlows,
}: MetricsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Metrics we send</CardTitle>
        <p className="text-xs text-muted-foreground font-normal mt-1">
          Accepted means Klaviyo took the event. Klaviyo counted is the daily ingest snapshot,
          kept for metrics accepted in the last two days. Delivery, opens, and clicks are on the Flows tab.
          {categoryLabel !== "All" ? ` Showing ${categoryLabel} only.` : null}
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {metrics.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No metrics in this window.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Metric</th>
                <th className="pb-2 pr-4 font-medium">Category</th>
                <th className="pb-2 pr-4 font-medium">In Klaviyo</th>
                <th className="pb-2 pr-4 text-right font-medium">Flows</th>
                <th className="pb-2 pr-4 text-right font-medium">Recipients</th>
                <th className="pb-2 pr-4 text-right font-medium">Accepted</th>
                <th className="pb-2 pr-4 text-right font-medium">Skipped</th>
                <th className="pb-2 pr-4 text-right font-medium">Failed</th>
                <th className="pb-2 text-right font-medium">Accept %</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => {
                const coverage = coverageByMetric.get(metric.metric)
                const skip = metric.skipped > 0 ? topSkipReason(metric.metric, skipByMetric) : null
                const klaviyoCount = klaviyoCounts.get(metric.metric)
                const inKlaviyo = coverage ? coverage.coverage !== "metric_missing" : null
                const flowCount = coverage?.flows.length ?? 0
                return (
                  <tr key={metric.metric} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4">
                      <button
                        type="button"
                        className="font-medium text-left hover:underline"
                        onClick={() => onOpenEventLog(metric.metric)}
                      >
                        {metric.metric}
                      </button>
                      {skip ? (
                        <p className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">
                          Skipped: {skip.reason} ({skip.count})
                        </p>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge
                        variant="secondary"
                        className={cn("capitalize", CATEGORY_STYLES[metric.category])}
                      >
                        {metric.category}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4 text-xs font-medium">
                      {coverageLoading && !coverage ? (
                        <span className="text-muted-foreground">…</span>
                      ) : inKlaviyo == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={inKlaviyo ? "text-emerald-600" : "text-muted-foreground"}>
                          {inKlaviyo ? "Yes" : "No"}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {coverageLoading && !coverage ? (
                        <span className="text-muted-foreground">…</span>
                      ) : (
                        <button
                          type="button"
                          className="hover:underline"
                          onClick={() => onOpenFlows(metric.metric)}
                        >
                          {flowCount}
                        </button>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{metric.uniqueRecipients}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-emerald-600">
                      {metric.sent}
                      {klaviyoCount != null ? (
                        <span className="block text-xs font-normal text-muted-foreground">
                          Klaviyo counted {klaviyoCount}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-amber-600">{metric.skipped}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-rose-600">{metric.failed}</td>
                    <td className="py-2 text-right tabular-nums">{formatPct(metric.sent, metric.total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}
