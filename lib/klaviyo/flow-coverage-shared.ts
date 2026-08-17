/** Client-safe types for Klaviyo flow coverage (admin Notifications center). */

export type KlaviyoFlowCoverageStatus =
  | "covered"
  | "live_no_email"
  | "draft_or_manual"
  | "no_flow"
  | "metric_missing"

export type KlaviyoFlowCoverageFilter = "all" | "covered" | "gaps" | "metric_missing"

export const KLAVIYO_FLOW_COVERAGE_FILTERS: {
  value: KlaviyoFlowCoverageFilter
  label: string
}[] = [
  { value: "all", label: "All" },
  { value: "covered", label: "Covered" },
  { value: "gaps", label: "Gaps" },
  { value: "metric_missing", label: "Missing metric" },
]

export interface KlaviyoFlowCoverageFlowRow {
  id: string
  name: string
  status: string
  hasEmailAction: boolean
}

export interface KlaviyoFlowCoverageMetricRow {
  metric: string
  coverage: KlaviyoFlowCoverageStatus
  hasLiveFlow: boolean
  hasLiveEmail: boolean
  flows: KlaviyoFlowCoverageFlowRow[]
}

export interface KlaviyoFlowCoverageTotals {
  covered: number
  liveNoEmail: number
  draftOrManual: number
  noFlow: number
  metricMissing: number
  total: number
}

export interface KlaviyoFlowCoverageResult {
  fetchedAt: string
  byMetric: KlaviyoFlowCoverageMetricRow[]
  totals: KlaviyoFlowCoverageTotals
}

export function isKlaviyoFlowCoverageFilter(value: unknown): value is KlaviyoFlowCoverageFilter {
  return (
    value === "all" ||
    value === "covered" ||
    value === "gaps" ||
    value === "metric_missing"
  )
}

export function metricMatchesFlowCoverageFilter(
  row: KlaviyoFlowCoverageMetricRow,
  filter: KlaviyoFlowCoverageFilter,
): boolean {
  if (filter === "all") return true
  if (filter === "covered") return row.coverage === "covered"
  if (filter === "metric_missing") return row.coverage === "metric_missing"
  // gaps = anything not fully covered with a live email
  return row.coverage !== "covered"
}
