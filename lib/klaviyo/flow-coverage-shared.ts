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
  flows: KlaviyoFlowDirectoryRow[]
  flowTotals: KlaviyoFlowDirectoryTotals
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

export type KlaviyoFlowTriggerKind = "metric" | "list" | "segment" | "date" | "price_drop" | "other"

export type KlaviyoFlowDirectoryFilter =
  | "all"
  | "live"
  | "draft"
  | "email"
  | "sms"
  | "metric"
  | "other"
  | "unmapped"

export const KLAVIYO_FLOW_DIRECTORY_FILTERS: {
  value: KlaviyoFlowDirectoryFilter
  label: string
}[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "draft", label: "Draft" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "metric", label: "Metric trigger" },
  { value: "other", label: "Other trigger" },
  { value: "unmapped", label: "Unmapped" },
]

/** One Klaviyo flow, including list, date, and price-drop triggers. */
export interface KlaviyoFlowDirectoryRow {
  id: string
  name: string
  status: string
  archived: boolean
  triggerKind: KlaviyoFlowTriggerKind
  triggerLabel: string
  triggerMetrics: string[]
  hasEmail: boolean | null
  hasSms: boolean | null
  updatedAt: string | null
}

export interface KlaviyoFlowDirectoryTotals {
  total: number
  live: number
  draftOrManual: number
  withEmail: number
  withSms: number
  metricTriggered: number
  otherTriggered: number
  unmapped: number
}

export function isKlaviyoFlowDirectoryFilter(value: unknown): value is KlaviyoFlowDirectoryFilter {
  return KLAVIYO_FLOW_DIRECTORY_FILTERS.some((filter) => filter.value === value)
}

export function klaviyoFlowTriggerKind(triggerType: string | undefined): KlaviyoFlowTriggerKind {
  const value = (triggerType ?? "").trim().toLowerCase()
  if (value === "metric") return "metric"
  if (value.includes("list")) return "list"
  if (value.includes("segment")) return "segment"
  if (value.includes("date")) return "date"
  if (value.includes("price") || value.includes("inventory")) return "price_drop"
  return "other"
}

export function klaviyoFlowTriggerLabel(
  kind: KlaviyoFlowTriggerKind,
  metrics: string[],
  rawTriggerType: string | undefined,
): string {
  if (kind === "metric") {
    if (metrics.length > 0) return metrics.join(", ")
    return "Metric"
  }
  if (kind === "list") return "Added to list"
  if (kind === "segment") return "Segment"
  if (kind === "date") return "Date"
  if (kind === "price_drop") return "Price drop"
  const trimmed = rawTriggerType?.trim()
  return trimmed || "Other"
}

export function klaviyoFlowEditorUrl(flowId: string): string {
  return `https://www.klaviyo.com/flow/${encodeURIComponent(flowId)}/edit`
}

export function isUnmappedKlaviyoFlow(
  row: KlaviyoFlowDirectoryRow,
  knownMetricNames: readonly string[],
): boolean {
  if (row.triggerKind !== "metric") return false
  if (row.triggerMetrics.length === 0) return true
  return row.triggerMetrics.some((metric) => !knownMetricNames.includes(metric))
}

export function summarizeFlowDirectory(
  rows: readonly KlaviyoFlowDirectoryRow[],
  knownMetricNames: readonly string[],
): KlaviyoFlowDirectoryTotals {
  const active = rows.filter((row) => !row.archived)
  return {
    total: active.length,
    live: active.filter((row) => row.status === "live").length,
    draftOrManual: active.filter((row) => row.status !== "live").length,
    withEmail: active.filter((row) => row.hasEmail === true).length,
    withSms: active.filter((row) => row.hasSms === true).length,
    metricTriggered: active.filter((row) => row.triggerKind === "metric").length,
    otherTriggered: active.filter((row) => row.triggerKind !== "metric").length,
    unmapped: active.filter((row) => isUnmappedKlaviyoFlow(row, knownMetricNames)).length,
  }
}

export function flowMatchesDirectoryFilter(
  row: KlaviyoFlowDirectoryRow,
  filter: KlaviyoFlowDirectoryFilter,
  knownMetricNames: readonly string[],
  metricFocus: string | null,
): boolean {
  if (row.archived) return false
  if (metricFocus && !row.triggerMetrics.includes(metricFocus)) return false
  if (filter === "all") return true
  if (filter === "live") return row.status === "live"
  if (filter === "draft") return row.status !== "live"
  if (filter === "email") return row.hasEmail === true
  if (filter === "sms") return row.hasSms === true
  if (filter === "metric") return row.triggerKind === "metric"
  if (filter === "other") return row.triggerKind !== "metric"
  return isUnmappedKlaviyoFlow(row, knownMetricNames)
}
