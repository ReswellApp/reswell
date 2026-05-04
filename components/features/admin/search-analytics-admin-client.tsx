"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { format, formatDistanceToNow, parseISO } from "date-fns"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type {
  SearchAnalyticsDashboard,
  SearchTrendPeriodDetailPayload,
} from "@/lib/services/searchAnalytics"
import { cn } from "@/lib/utils"

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const

type PeriodTrendSortKey = "velocity" | "recent" | "prior" | "query"

const PERIOD_TREND_SORT_OPTIONS: { value: PeriodTrendSortKey; label: string }[] = [
  { value: "velocity", label: "Velocity (high → low)" },
  { value: "recent", label: "Recent count" },
  { value: "prior", label: "Prior count" },
  { value: "query", label: "Query (A→Z)" },
]

function defaultUtcPriorMonthYm(): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  d.setUTCMonth(d.getUTCMonth() - 1)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  return `${y}-${String(m).padStart(2, "0")}`
}

function utcYearMonthChoices(count: number): string[] {
  const months: string[] = []
  const now = new Date()
  let y = now.getUTCFullYear()
  let mo = now.getUTCMonth() + 1
  for (let i = 0; i < count; i++) {
    months.push(`${y}-${String(mo).padStart(2, "0")}`)
    mo -= 1
    if (mo < 1) {
      mo = 12
      y -= 1
    }
  }
  return months
}

/** Match the prior single-dropdown reach (months you can drill into). */
const PERIOD_TREND_ROLLING_MONTHS = 36

function buildUtcRollingYmWindow(count: number): {
  rolling: string[]
  earliestYm: string
  latestYm: string
} {
  const rolling = utcYearMonthChoices(count)
  if (rolling.length === 0)
    return { rolling: [], earliestYm: "", latestYm: "" }
  return {
    rolling,
    earliestYm: rolling[rolling.length - 1] ?? "",
    latestYm: rolling[0] ?? "",
  }
}

function utcDistinctYearsDescendingFromRolling(rolling: string[]): number[] {
  if (rolling.length === 0) return []
  return [...new Set(rolling.map((ym) => Number(ym.slice(0, 4))))].sort((a, b) => b - a)
}

/** UTC calendar months 1–12 (January → December) shown in Month filter regardless of Rolling window edges. */
const UTC_CALENDAR_MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const
function formatUtcMonthName(monthNum: number): string {
  return format(new Date(Date.UTC(2000, monthNum - 1, 1)), "MMMM")
}

function splitYm(yM: string): { yStr: string; mStr: string } {
  const dash = yM.indexOf("-")
  if (dash < 0) return { yStr: "1970", mStr: "01" }
  const yStr = yM.slice(0, dash)
  const mNum = Number(yM.slice(dash + 1))
  const safe =
    Number.isInteger(mNum) && mNum >= 1 && mNum <= 12 ? mNum : 1
  return { yStr, mStr: String(safe).padStart(2, "0") }
}

const ACCENT = {
  primary: "hsl(221.2 83.2% 53.3%)",
  muted: "hsl(215 16% 47%)",
  rose: "hsl(350 80% 52%)",
  amber: "hsl(38 92% 50%)",
  teal: "hsl(173 58% 39%)",
  violet: "hsl(262 83% 58%)",
}

/** Muted report palette (matches NGO-style pie reference). */
const REPORT_PIE_PALETTE = [
  "#EBC045",
  "#AED8F7",
  "#C74D4A",
  "#4E9E4D",
  "#9842E3",
  "#B89B37",
] as const

const SUGGEST_KIND_LABELS: Record<string, string> = {
  top_listing: "Top listing row",
  brand_strip: "Brand (chip strip)",
  brand_row: "Brand (vertical list)",
  category_chip: "Category chip",
  suggestion_title: "Suggestions · title",
  suggestion_brand: "Suggestions · brand",
  suggestion_category: "Suggestions · category",
  view_all_results: "View all results",
  brand_catalog: "Brand catalog row",
}

const SUGGEST_TRACE_LABELS: Record<string, string> = {
  marketplace_elasticsearch: "Marketplace · Elasticsearch",
  marketplace_supabase: "Marketplace · Database",
  brand_catalog_elasticsearch: "Brand catalog · Elasticsearch",
  brand_catalog_supabase: "Brand catalog · Database",
}

/** Treemap tile colors aligned with the “Enhance Data Visualizations” reference. */
const TREEMAP_SLATE_FILLS = ["#0F172A", "#1E293B", "#334155", "#475569", "#64748B"] as const

type ReportPieRow = { name: string; value: number; fill?: string }

function truncateQuery(q: string, max = 36): string {
  const t = q.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function reportPieLabelProps(props: Record<string, unknown>): {
  cx: number
  cy: number
  midAngle: number
  innerRadius: number
  outerRadius: number
  name: string
  percent: number
  payload: { fill?: string; name?: string }
} {
  return {
    cx: Number(props.cx ?? 0),
    cy: Number(props.cy ?? 0),
    midAngle: Number(props.midAngle ?? 0),
    innerRadius: Number(props.innerRadius ?? 0),
    outerRadius: Number(props.outerRadius ?? 0),
    name: String(props.name ?? (props.payload as { name?: string })?.name ?? ""),
    percent: Number(props.percent ?? 0),
    payload: (props.payload as { fill?: string; name?: string }) ?? {},
  }
}

function ReportPieInsideLabel(
  props: Record<string, unknown>,
  minPct: number,
): ReactNode {
  const p = reportPieLabelProps(props)
  if (p.percent < minPct) return null
  const RAD = Math.PI / 180
  const r = p.innerRadius + (p.outerRadius - p.innerRadius) * 0.52
  const x = p.cx + r * Math.cos(-p.midAngle * RAD)
  const y = p.cy + r * Math.sin(-p.midAngle * RAD)
  const fill = p.payload.fill ?? "#374151"
  const pctLabel = `${Math.round(p.percent * 100)}%`
  const raw = p.name
  const short = raw.length > 20 ? `${raw.slice(0, 18)}…` : raw
  const w = Math.min(132, Math.max(72, short.length * 5.8 + 32))
  const h = 40
  return (
    <g transform={`translate(${x},${y})`}>
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={5}
        fill={fill}
        fillOpacity={0.94}
        stroke="#ffffff"
        strokeWidth={1.5}
      />
      <text
        textAnchor="middle"
        y={-7}
        className="fill-white text-[8px] font-semibold uppercase tracking-wide"
      >
        {short}
      </text>
      <text textAnchor="middle" y={11} className="fill-white text-sm font-bold tabular-nums">
        {pctLabel}
      </text>
    </g>
  )
}

function ReportStylePieBlock({
  rows,
  innerRadius = 0,
  minLabelPercent = 0.055,
  className,
}: {
  rows: ReportPieRow[]
  innerRadius?: number
  minLabelPercent?: number
  className?: string
}) {
  const total = rows.reduce((s, r) => s + r.value, 0)
  const data = rows
    .filter((r) => r.value > 0)
    .map((r, i) => ({
      ...r,
      fill: r.fill ?? REPORT_PIE_PALETTE[i % REPORT_PIE_PALETTE.length],
    }))

  if (total === 0 || data.length === 0) return null

  return (
    <div
      className={cn(
        "flex flex-col items-stretch gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8",
        className,
      )}
    >
      <ChartContainer
        config={{
          slice: { label: "Slice", color: REPORT_PIE_PALETTE[0] },
        }}
        className="mx-auto aspect-square h-[min(280px,72vw)] w-[min(280px,72vw)] shrink-0 sm:mx-0 sm:h-[260px] sm:w-[260px]"
      >
        <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius="78%"
            paddingAngle={0}
            labelLine={false}
            label={(p) => ReportPieInsideLabel(p as Record<string, unknown>, minLabelPercent)}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${entry.name}-${index}`} fill={entry.fill} stroke="#ffffff" strokeWidth={2} />
            ))}
          </Pie>
          <RechartsTooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null
              const row = payload[0].payload as { name: string; value: number }
              const pct = total > 0 ? ((row.value / total) * 100).toFixed(1) : "0"
              return (
                <div className="rounded-md border border-border/80 bg-background px-2.5 py-1.5 text-xs shadow-md">
                  <p className="font-medium text-foreground">{row.name}</p>
                  <p className="text-muted-foreground tabular-nums">
                    {row.value.toLocaleString()} searches ({pct}%)
                  </p>
                </div>
              )
            }}
          />
        </PieChart>
      </ChartContainer>
      <ul className="flex min-w-0 flex-1 flex-col gap-3 text-sm sm:max-w-[280px]">
        {data.map((row) => {
          const pct = total > 0 ? Math.round((row.value / total) * 100) : 0
          return (
            <li
              key={row.name}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full border border-white shadow-sm"
                  style={{ backgroundColor: row.fill }}
                />
                <span className="truncate font-medium text-slate-700">{row.name}</span>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{pct}%</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function movingAverageSeries(
  rows: { date: string; count: number }[],
  window: number,
): { date: string; count: number; ma: number | null }[] {
  return rows.map((row, i) => {
    const start = Math.max(0, i - window + 1)
    const slice = rows.slice(start, i + 1)
    const sum = slice.reduce((s, r) => s + r.count, 0)
    const ma = slice.length >= 2 ? Math.round((sum / slice.length) * 10) / 10 : null
    return { ...row, ma: i === 0 ? null : ma }
  })
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

function volumeTrendDelta(rows: { count: number }[]): {
  change: string
  changeType: "positive" | "negative" | "neutral"
} {
  if (rows.length < 2) return { change: "—", changeType: "neutral" }
  const mid = Math.floor(rows.length / 2) || 1
  const first = rows.slice(0, mid).reduce((s, r) => s + r.count, 0)
  const second = rows.slice(mid).reduce((s, r) => s + r.count, 0)
  if (first === 0 && second === 0) return { change: "0%", changeType: "neutral" }
  const base = Math.max(first, 1)
  const pct = ((second - first) / base) * 100
  const rounded = Math.round(pct * 10) / 10
  const sign = rounded > 0 ? "+" : ""
  return {
    change: `${sign}${rounded}%`,
    changeType:
      rounded > 0.5 ? "positive" : rounded < -0.5 ? "negative" : "neutral",
  }
}

function AnalyticsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: unknown; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-xs shadow-xl">
      {label ? (
        <div className="mb-2 border-b border-slate-700 pb-2 font-medium text-slate-300">
          {label}
        </div>
      ) : null}
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 font-medium text-slate-200">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color ?? "#94a3b8" }}
              />
              {entry.name}
            </span>
            <span className="font-bold text-white tabular-nums">
              {typeof entry.value === "number"
                ? Number.isInteger(entry.value)
                  ? entry.value.toLocaleString()
                  : entry.value.toFixed(2)
                : String(entry.value ?? "")}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DashboardKPICard({
  label,
  value,
  change,
  changeType,
  subtitle,
  icon,
  trend,
}: {
  label: string
  value: string
  change: string
  changeType: "positive" | "negative" | "neutral"
  subtitle: string
  icon: string
  trend: { count: number }[]
}) {
  const changeColors = {
    positive: "text-emerald-600 bg-emerald-50 border-emerald-200",
    negative: "text-rose-600 bg-rose-50 border-rose-200",
    neutral: "text-slate-600 bg-slate-50 border-slate-200",
  }
  const trendColor = {
    positive: "#10B981",
    negative: "#F43F5E",
    neutral: "#64748B",
  }
  const stroke = trendColor[changeType]
  const gradId = `kpi-${label.replace(/\s+/g, "-")}`

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="mb-4 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-2xl" aria-hidden>
              {icon}
            </span>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {label}
            </span>
          </div>
          <div className="mb-1 text-3xl font-bold tabular-nums text-slate-900">{value}</div>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold",
            changeColors[changeType],
          )}
        >
          {change}
        </span>
      </div>
      {trend.length > 1 ? (
        <div className="h-16 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="count"
                stroke={stroke}
                strokeWidth={2}
                fill={`url(#${gradId})`}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  )
}

export function SearchAnalyticsAdminClient() {
  const [days, setDays] = useState<string>("14")
  const [data, setData] = useState<SearchAnalyticsDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initialAttemptDoneRef = useRef(false)

  const periodRollingYm = useMemo(
    () => buildUtcRollingYmWindow(PERIOD_TREND_ROLLING_MONTHS),
    [],
  )
  const periodYearChoicesDescending = useMemo(
    () => utcDistinctYearsDescendingFromRolling(periodRollingYm.rolling),
    [periodRollingYm.rolling],
  )

  const [periodTrendMode, setPeriodTrendMode] = useState<"all" | "month">("all")
  const [periodTrendYearUtc, setPeriodTrendYearUtc] = useState(() =>
    splitYm(defaultUtcPriorMonthYm()).yStr)
  const [periodTrendMonthUtc, setPeriodTrendMonthUtc] = useState(() =>
    splitYm(defaultUtcPriorMonthYm()).mStr)

  const [periodTrendSort, setPeriodTrendSort] = useState<PeriodTrendSortKey>("velocity")
  const [periodTrendPayload, setPeriodTrendPayload] =
    useState<SearchTrendPeriodDetailPayload | null>(null)
  const [periodTrendLoading, setPeriodTrendLoading] = useState(false)
  const [periodTrendError, setPeriodTrendError] = useState<string | null>(null)

  const periodTrendMonthYm = useMemo(
    () => `${periodTrendYearUtc}-${periodTrendMonthUtc.padStart(2, "0")}`,
    [periodTrendYearUtc, periodTrendMonthUtc],
  )

  useEffect(() => {
    if (periodYearChoicesDescending.length === 0) return
    const y = Number(periodTrendYearUtc)
    if (periodYearChoicesDescending.includes(y)) return
    setPeriodTrendYearUtc(String(periodYearChoicesDescending[0]))
  }, [periodYearChoicesDescending, periodTrendYearUtc])

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      setError(null)
      const firstEver = !initialAttemptDoneRef.current
      if (firstEver) setLoading(true)
      else if (!opts?.silent) setRefreshing(true)
      try {
        const res = await fetch(`/api/admin/search-analytics?days=${days}`, {
          credentials: "include",
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(typeof body.error === "string" ? body.error : "Could not load analytics")
          setData(null)
          return
        }
        setData(body.data as SearchAnalyticsDashboard)
      } catch {
        setError("Could not load analytics")
        setData(null)
      } finally {
        if (firstEver) {
          setLoading(false)
          initialAttemptDoneRef.current = true
        } else if (!opts?.silent) {
          setRefreshing(false)
        }
      }
    },
    [days],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!data?.configured) {
      setPeriodTrendPayload(null)
      setPeriodTrendLoading(false)
      setPeriodTrendError(null)
      return
    }

    let cancelled = false
    setPeriodTrendError(null)
    setPeriodTrendLoading(true)

    const qs =
      periodTrendMode === "all"
        ? "mode=all"
        : `mode=month&yearMonth=${encodeURIComponent(periodTrendMonthYm)}`

    void (async () => {
      try {
        const res = await fetch(`/api/admin/search-analytics/trend-period?${qs}`, {
          credentials: "include",
        })
        const body = await res.json().catch(() => ({}))
        if (cancelled) return

        if (!res.ok) {
          setPeriodTrendPayload(null)
          setPeriodTrendError(
            typeof body.error === "string"
              ? body.error
              : "Could not load period trending detail",
          )
          return
        }

        setPeriodTrendPayload(body.data as SearchTrendPeriodDetailPayload)
      } catch {
        if (!cancelled) {
          setPeriodTrendPayload(null)
          setPeriodTrendError("Could not load period trending detail")
        }
      } finally {
        if (!cancelled) setPeriodTrendLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [data?.configured, periodTrendMode, periodTrendMonthYm])

  const volumeWithMa = useMemo(
    () => movingAverageSeries(data?.volumeByDay ?? [], 3),
    [data?.volumeByDay],
  )

  const topBarData = useMemo(
    () =>
      (data?.topQueries ?? []).slice(0, 16).map((row) => ({
        ...row,
        short: truncateQuery(row.query, 30),
      })),
    [data?.topQueries],
  )

  const backendPieRows = useMemo((): ReportPieRow[] => {
    return (data?.byBackend ?? []).map((row, i) => ({
      name: row.backend === "elasticsearch" ? "Elasticsearch" : "Database (fallback)",
      value: row.count,
      fill: REPORT_PIE_PALETTE[i % REPORT_PIE_PALETTE.length],
    }))
  }, [data?.byBackend])

  const suggestPickChartRows = useMemo(
    () =>
      (data?.suggestPicksByKind ?? [])
        .filter((r) => r.count > 0)
        .map((row) => ({
          ...row,
          label: SUGGEST_KIND_LABELS[row.kind] ?? row.kind,
        })),
    [data?.suggestPicksByKind],
  )

  const suggestTraceChartRows = useMemo(
    () =>
      (data?.suggestPicksByTrace ?? [])
        .filter((r) => r.count > 0)
        .map((row) => ({
          ...row,
          label: SUGGEST_TRACE_LABELS[row.trace] ?? row.trace,
        })),
    [data?.suggestPicksByTrace],
  )

  const suggestPrefixClickChartRows = useMemo(
    () =>
      (data?.suggestTopQueryPrefixes ?? [])
        .filter((r) => r.count > 0)
        .map((row) => ({
          ...row,
          short: truncateQuery(row.prefix, 28),
        })),
    [data?.suggestTopQueryPrefixes],
  )

  const suggestPrefixHoverChartRows = useMemo(
    () =>
      (data?.suggestTopQueryPrefixesHover ?? [])
        .filter((r) => r.count > 0)
        .map((row) => ({
          ...row,
          short: truncateQuery(row.prefix, 28),
        })),
    [data?.suggestTopQueryPrefixesHover],
  )

  const suggestHoverKindChartRows = useMemo(
    () =>
      (data?.suggestHoversByKind ?? [])
        .filter((r) => r.count > 0)
        .map((row) => ({
          ...row,
          label: SUGGEST_KIND_LABELS[row.kind] ?? row.kind,
        })),
    [data?.suggestHoversByKind],
  )

  const suggestListingClickChartRows = useMemo(
    () =>
      (data?.suggestTopListingClicks ?? []).map((row) => ({
        ...row,
        short: truncateQuery(row.title, 26),
      })),
    [data?.suggestTopListingClicks],
  )

  /** Bands for “Search volume with recent-peak context”: daily count vs trailing max and a midpoint blend. */
  const activityBandsData = useMemo(() => {
    return volumeWithMa.map((row, i) => {
      const slice = volumeWithMa.slice(Math.max(0, i - 3), i + 1)
      const peak = slice.reduce((m, r) => Math.max(m, r.count), 0)
      return {
        date: row.date,
        p50: row.count,
        p95: Math.round((row.count + peak) / 2),
        p99: peak,
      }
    })
  }, [volumeWithMa])

  const radarRows = useMemo(() => {
    if (!data || data.totalSearches < 1) return []
    const t = data.totalSearches
    const es =
      data.byBackend.find((b) => b.backend === "elasticsearch")?.count ?? 0
    const esReliance = clamp((es / t) * 100, 0, 100)
    const success = clamp((1 - (data.zeroResultSearchShare ?? 0)) * 100, 0, 100)
    const breadth = clamp((data.uniqueQueriesApprox / t) * 100 * 1.2, 0, 100)
    const spread = clamp(
      (1 - (data.queryConcentration ?? 0.15)) * 100,
      0,
      100,
    )
    return [
      { subject: "ES reliance", A: Math.round(esReliance), fullMark: 100 },
      { subject: "Non-empty rate", A: Math.round(success), fullMark: 100 },
      { subject: "Query breadth", A: Math.round(breadth), fullMark: 100 },
      { subject: "Demand spread", A: Math.round(spread), fullMark: 100 },
    ]
  }, [data])

  const distPieRows = useMemo((): ReportPieRow[] => {
    const d = data?.resultCountDistribution ?? []
    return d.map((x, i) => ({
      name:
        x.band === "0"
          ? "0 results"
          : x.band === "1-5"
            ? "1–5 listings"
            : x.band === "6-15"
              ? "6–15 listings"
              : "16+ listings",
      value: x.count,
      fill: REPORT_PIE_PALETTE[i % REPORT_PIE_PALETTE.length],
    }))
  }, [data?.resultCountDistribution])

  const categoryScopeRow = useMemo(() => {
    if (!data?.categoryFilterSplit.length) return null
    const filtered =
      data.categoryFilterSplit.find((c) => c.key === "category_filter")?.count ?? 0
    const open =
      data.categoryFilterSplit.find((c) => c.key === "open_search")?.count ?? 0
    if (filtered + open === 0) return null
    return { label: "Scope", filtered, open }
  }, [data?.categoryFilterSplit])

  const categoryPieRows = useMemo((): ReportPieRow[] => {
    if (!categoryScopeRow) return []
    return [
      {
        name: "Category filter",
        value: categoryScopeRow.filtered,
        fill: REPORT_PIE_PALETTE[1],
      },
      {
        name: "Open search",
        value: categoryScopeRow.open,
        fill: REPORT_PIE_PALETTE[0],
      },
    ]
  }, [categoryScopeRow])

  const trendingScatter = useMemo(
    () =>
      (data?.trendingQueries ?? []).map((r) => ({
        query: r.query,
        recent: r.recentCount,
        velocity: Math.round(r.velocity * 100) / 100,
      })),
    [data?.trendingQueries],
  )

  const periodTrendRowsSorted = useMemo(() => {
    const rows = periodTrendPayload?.trendingQueries ?? []
    const copy = [...rows]
    if (periodTrendSort === "velocity") {
      copy.sort((a, b) => b.velocity - a.velocity || b.recentCount - a.recentCount)
    } else if (periodTrendSort === "recent") {
      copy.sort((a, b) => b.recentCount - a.recentCount || b.velocity - a.velocity)
    } else if (periodTrendSort === "prior") {
      copy.sort(
        (a, b) =>
          b.previousCount - a.previousCount || b.recentCount - a.recentCount,
      )
    } else {
      copy.sort((a, b) => a.query.localeCompare(b.query))
    }
    return copy
  }, [periodTrendPayload?.trendingQueries, periodTrendSort])

  const zeroSharePct =
    data?.zeroResultSearchShare != null
      ? Math.round(data.zeroResultSearchShare * 1000) / 10
      : null

  const sparkSlice = useMemo(
    () => (data?.volumeByDay ?? []).slice(-8),
    [data?.volumeByDay],
  )

  const volTrend = volumeTrendDelta(data?.volumeByDay ?? [])
  const kpiSpark = data?.volumeByDay?.length ? data.volumeByDay : sparkSlice

  const brandDirBackendPieRows = useMemo((): ReportPieRow[] => {
    return (data?.brandDirectory?.byBackend ?? []).map((row, i) => ({
      name: row.backend === "elasticsearch" ? "Elasticsearch" : "Database (fallback)",
      value: row.count,
      fill: REPORT_PIE_PALETTE[i % REPORT_PIE_PALETTE.length],
    }))
  }, [data?.brandDirectory?.byBackend])

  const brandDirTopBarData = useMemo(
    () =>
      (data?.brandDirectory?.topQueries ?? []).slice(0, 16).map((row) => ({
        ...row,
        short: truncateQuery(row.query, 28),
      })),
    [data?.brandDirectory?.topQueries],
  )

  const brandDirZeroPct =
    data?.brandDirectory?.zeroResultSearchShare != null
      ? Math.round(data.brandDirectory.zeroResultSearchShare * 1000) / 10
      : null

  const brandDirVolumeChartData = useMemo(
    () => data?.brandDirectory?.volumeByDay ?? [],
    [data?.brandDirectory?.volumeByDay],
  )

  const navBarChartRows = useMemo(
    () => data?.navSearchBar?.volumeByDay ?? [],
    [data?.navSearchBar?.volumeByDay],
  )

  const navBarTopFreeFormRows = useMemo(
    () =>
      (data?.navSearchBar?.topFreeFormQueries ?? []).slice(0, 14).map((row) => ({
        ...row,
        short: truncateQuery(row.query, 28),
      })),
    [data?.navSearchBar?.topFreeFormQueries],
  )

  const periodTrendShowSpinner = Boolean(
    data?.configured &&
      (periodTrendLoading || (periodTrendPayload === null && !periodTrendError)),
  )

  return (
    <div className="w-full space-y-0 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 sm:p-6 dark:bg-transparent dark:border-border">
      {error && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-20 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading search analytics…
        </div>
      ) : data && !data.configured ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Elasticsearch not configured</h2>
          <p className="mt-2 text-sm text-slate-600">
            Set cluster URL and credentials; this dashboard reads the same client as listing search.
          </p>
        </div>
      ) : data ? (
        <div className="min-h-[60vh] w-full max-w-[1600px] space-y-8">
          {/* Top bar — reference dashboard header */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Search Analytics Dashboard</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Marketplace search volume, typeahead picks, and Elasticsearch-backed aggregates
                </p>
                <p className="mt-2 max-w-2xl text-xs text-slate-500">
                  <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">reswell_search_analytics</code>{" "}
                  — marketplace <code className="rounded bg-slate-100 px-1 text-[11px]">search_surface: marketplace</code>{" "}
                  (optional <code className="rounded bg-slate-100 px-1 text-[11px]">origin_surface: header_nav</code> for nav{" "}
                  <code className="rounded bg-slate-100 px-1 text-[11px]">nq=1</code>) and brand directory{" "}
                  <code className="rounded bg-slate-100 px-1 text-[11px]">brand_directory</code> ·{" "}
                  <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">
                    reswell_search_suggest_analytics
                  </code>{" "}
                  (dropdown clicks)
                </p>
              </div>
              <div className="flex flex-col items-stretch gap-3 sm:items-end">
                <div className="flex items-center gap-3">
                  <div className="text-right text-sm">
                    <div className="text-xs text-slate-500">Last updated</div>
                    <div className="font-medium text-slate-700">
                      {data.fetchedAt
                        ? format(parseISO(data.fetchedAt), "MMM d, yyyy h:mm a")
                        : "—"}
                    </div>
                  </div>
                  <div
                    className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 animate-pulse"
                    aria-hidden
                  />
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Range
                  </span>
                  <Select value={days} onValueChange={setDays}>
                    <SelectTrigger className="h-9 w-[168px] border-slate-200 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RANGE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 border-slate-200 bg-white"
                    onClick={() => void load({ silent: false })}
                    disabled={refreshing}
                  >
                    {refreshing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-2">Refresh</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <DashboardKPICard
              label="Total searches"
              value={data.totalSearches.toLocaleString()}
              change={volTrend.change}
              changeType={volTrend.changeType}
              subtitle={`Marketplace /search · ${data.rangeDays}d`}
              icon="📊"
              trend={kpiSpark}
            />
            <DashboardKPICard
              label="Unique queries"
              value={data.uniqueQueriesApprox.toLocaleString()}
              change={volTrend.change}
              changeType={volTrend.changeType}
              subtitle="Marketplace · ES cardinality (approx.)"
              icon="🔍"
              trend={kpiSpark}
            />
            <DashboardKPICard
              label="Avg. results"
              value={
                data.avgResultCount != null && Number.isFinite(data.avgResultCount)
                  ? data.avgResultCount.toFixed(1)
                  : "—"
              }
              change="—"
              changeType="neutral"
              subtitle={
                data.resultCountStats.max != null
                  ? `Listings · max ${data.resultCountStats.max} · σ ${data.resultCountStats.stdDeviation != null ? data.resultCountStats.stdDeviation.toFixed(1) : "—"}`
                  : "Mean listings returned per search"
              }
              icon="📈"
              trend={kpiSpark}
            />
            <DashboardKPICard
              label="Zero-result share"
              value={zeroSharePct != null ? `${zeroSharePct}%` : "—"}
              change="—"
              changeType="neutral"
              subtitle={
                data.queryConcentration != null
                  ? `Marketplace HHI ${data.queryConcentration.toFixed(2)}`
                  : "Marketplace · no matching listings"
              }
              icon="🎯"
              trend={kpiSpark}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Header nav search bar — daily activity</h3>
                <p className="mt-1 max-w-3xl text-sm text-slate-500">
                  <span className="font-medium text-slate-700">Blue</span>: keyword searches submitted from the nav bar
                  (Enter / recent chips / suggestion rows that open{" "}
                  <code className="rounded bg-slate-100 px-1 text-[11px]">/search?q=</code>
                  ). Attribution uses a brief <code className="rounded bg-slate-100 px-1 text-[11px]">nq=1</code> marker
                  stripped after load.{" "}
                  <span className="font-medium text-slate-700">Purple</span>: clicks on typeahead rows while the nav field
                  is focused (<code className="rounded bg-slate-100 px-1 text-[11px]">surface: header_nav</code>). Idle-panel
                  listing links skip marketplace search and are excluded here.
                </p>
                <p className="mt-2 text-xs tabular-nums text-slate-500">
                  {(data.navSearchBar.totalFreeFormSubmits + data.navSearchBar.totalDropdownSelections).toLocaleString()}{" "}
                  nav-attributed actions · {data.navSearchBar.totalFreeFormSubmits.toLocaleString()} free-form ·{" "}
                  {data.navSearchBar.totalDropdownSelections.toLocaleString()} dropdown clicks
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                  Free-form /search
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-800">
                  <span className="h-2 w-2 rounded-full bg-violet-600" />
                  Dropdown selection
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-8 xl:grid-cols-5">
              <div className="xl:col-span-3">
                {navBarChartRows.length === 0 ||
                (data.navSearchBar.totalFreeFormSubmits < 1 &&
                  data.navSearchBar.totalDropdownSelections < 1) ? (
                  <p className="py-12 text-center text-sm text-slate-500">
                    No nav-attributed events in this window yet. Ship builds that append{" "}
                    <code className="rounded bg-slate-100 px-1 text-[11px]">nq=1</code> from the header search and log
                    suggest picks with <code className="rounded bg-slate-100 px-1 text-[11px]">header_nav</code>.
                  </p>
                ) : (
                  <div className="h-[min(340px,42vh)] min-h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={navBarChartRows} margin={{ top: 8, right: 8, left: 4, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: "#64748B", fontSize: 11 }}
                          tickLine={false}
                          axisLine={{ stroke: "#E2E8F0" }}
                          tickFormatter={(v) => {
                            try {
                              return format(parseISO(String(v)), "MMM d")
                            } catch {
                              return String(v)
                            }
                          }}
                        />
                        <YAxis tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
                        <RechartsTooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null
                            let labelStr = ""
                            if (label != null && label !== "") {
                              try {
                                labelStr = format(parseISO(String(label)), "MMM d, yyyy")
                              } catch {
                                labelStr = String(label)
                              }
                            }
                            const rows = payload.map((p) => ({
                              name: String(p.name ?? p.dataKey ?? ""),
                              value: p.value,
                              color: p.color as string | undefined,
                            }))
                            return <AnalyticsTooltip active payload={rows} label={labelStr || undefined} />
                          }}
                        />
                        <Bar
                          dataKey="freeFormSubmits"
                          stackId="nav"
                          fill="#2563eb"
                          name="Free-form /search (nav)"
                          maxBarSize={44}
                        />
                        <Bar
                          dataKey="dropdownSelections"
                          stackId="nav"
                          fill="#7c3aed"
                          name="Dropdown row click"
                          maxBarSize={44}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              <div className="xl:col-span-2">
                <h4 className="mb-3 text-sm font-semibold text-slate-800">Top free-form queries (nav)</h4>
                <p className="mb-4 text-xs text-slate-500">
                  Normalized query text from marketplace logs with{" "}
                  <code className="rounded bg-slate-100 px-1 text-[11px]">origin_surface: header_nav</code>.
                </p>
                {navBarTopFreeFormRows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    No nav free-form searches in range (older rows lack origin tagging).
                  </p>
                ) : (
                  <div className="h-[min(340px,42vh)] min-h-[220px]">
                    <ChartContainer
                      config={{
                        nf: { label: "Searches", color: "hsl(221.2 83.2% 48%)" },
                      }}
                      className="h-full w-full"
                    >
                      <BarChart
                        data={[...navBarTopFreeFormRows].reverse()}
                        layout="vertical"
                        margin={{ left: 4, right: 8, top: 4, bottom: 4 }}
                      >
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 11 }} />
                        <YAxis
                          type="category"
                          dataKey="short"
                          width={132}
                          tick={{ fill: "#64748B", fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" fill="var(--color-nf)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Brand directory (/brands)</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Debounced catalog queries via <code className="rounded bg-slate-100 px-1 text-[11px]">searchBrandsCatalogSuggest</code> — same Elasticsearch / Supabase pipeline as the nav and Sell brand fields.{" "}
                  <span className="font-medium text-slate-600">Result count</span> is matching brand rows (cap 20), not
                  listings.
                </p>
              </div>
            </div>
            {data.brandDirectory.totalSearches < 1 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                No brand-directory searches logged in this range yet. Uses client builds that call{" "}
                <code className="rounded bg-slate-100 px-1 text-[11px]">recordBrandDirectorySearchAnalytics</code>.
              </p>
            ) : (
              <>
                <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Directory searches</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                      {data.brandDirectory.totalSearches.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Unique queries</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                      {data.brandDirectory.uniqueQueriesApprox.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Avg. brands returned</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                      {data.brandDirectory.avgResultCount != null &&
                      Number.isFinite(data.brandDirectory.avgResultCount)
                        ? data.brandDirectory.avgResultCount.toFixed(1)
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Zero-result share</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                      {brandDirZeroPct != null ? `${brandDirZeroPct}%` : "—"}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                  <div>
                    <h4 className="mb-4 text-sm font-semibold text-slate-800">Backend mix (directory)</h4>
                    {!brandDirBackendPieRows.some((r) => r.value > 0) ? (
                      <EmptyChart />
                    ) : (
                      <ReportStylePieBlock rows={brandDirBackendPieRows} minLabelPercent={0.05} />
                    )}
                  </div>
                  <div>
                    <h4 className="mb-4 text-sm font-semibold text-slate-800">Top directory queries</h4>
                    <div className="h-[min(280px,40vh)] min-h-[200px]">
                      {brandDirTopBarData.length === 0 ? (
                        <EmptyChart />
                      ) : (
                        <ChartContainer
                          config={{
                            bdq: { label: "Searches", color: "hsl(173 58% 39%)" },
                          }}
                          className="h-full w-full"
                        >
                          <BarChart
                            data={[...brandDirTopBarData].reverse()}
                            layout="vertical"
                            margin={{ left: 4, right: 8, top: 4, bottom: 4 }}
                          >
                            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#E2E8F0" />
                            <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                            <YAxis
                              type="category"
                              dataKey="short"
                              width={120}
                              tick={{ fill: "#64748B", fontSize: 10 }}
                              tickLine={false}
                              axisLine={false}
                            />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="count" fill="var(--color-bdq)" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ChartContainer>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-8">
                  <h4 className="mb-4 text-sm font-semibold text-slate-800">Daily volume (directory)</h4>
                  {brandDirVolumeChartData.length === 0 ? (
                    <EmptyChart />
                  ) : (
                    <div className="h-[220px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={brandDirVolumeChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                          <XAxis
                            dataKey="date"
                            tick={{ fill: "#64748B", fontSize: 11 }}
                            tickLine={false}
                            axisLine={{ stroke: "#E2E8F0" }}
                            tickFormatter={(v) => {
                              try {
                                return format(parseISO(String(v)), "MMM d")
                              } catch {
                                return String(v)
                              }
                            }}
                          />
                          <YAxis tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
                          <RechartsTooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null
                              let labelStr = ""
                              if (label != null && label !== "") {
                                try {
                                  labelStr = format(parseISO(String(label)), "MMM d, yyyy")
                                } catch {
                                  labelStr = String(label)
                                }
                              }
                              return (
                                <AnalyticsTooltip
                                  active
                                  payload={[{ name: "Searches", value: payload[0]?.value, color: "#0d9488" }]}
                                  label={labelStr || undefined}
                                />
                              )
                            }}
                          />
                          <Bar dataKey="count" fill="#14b8a6" radius={[4, 4, 0, 0]} maxBarSize={48} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Volume + MA — composed with gradient area (reference layout) */}
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Volume &amp; 3-day moving average
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Marketplace /search only — daily events with a smoothed trend line to damp single-day spikes
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                  Volume
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                  <span className="h-2 w-2 rounded-full bg-violet-600" />
                  3-day MA
                </span>
              </div>
            </div>
            {volumeWithMa.length === 0 ? (
              <EmptyChart />
            ) : (
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={volumeWithMa} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="volumeGradientDash" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#94A3B8"
                      tick={{ fill: "#64748B", fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: "#E2E8F0" }}
                      tickFormatter={(v) => {
                        try {
                          return format(parseISO(String(v)), "MMM d")
                        } catch {
                          return String(v)
                        }
                      }}
                    />
                    <YAxis
                      stroke="#94A3B8"
                      tick={{ fill: "#64748B", fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: "#E2E8F0" }}
                    />
                    <RechartsTooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const rows: { name: string; value: unknown; color?: string }[] = []
                        let sawCount = false
                        for (const p of payload) {
                          if (p.dataKey === "count") {
                            if (sawCount) continue
                            sawCount = true
                            rows.push({
                              name: "Volume",
                              value: p.value,
                              color: "#3B82F6",
                            })
                            continue
                          }
                          if (p.dataKey === "ma") {
                            rows.push({
                              name: "3d MA",
                              value: p.value,
                              color: String(p.color ?? "#8B5CF6"),
                            })
                          }
                        }
                        let labelStr = ""
                        if (label != null && label !== "") {
                          try {
                            labelStr = format(parseISO(String(label)), "MMM d, yyyy")
                          } catch {
                            labelStr = String(label)
                          }
                        }
                        return <AnalyticsTooltip active payload={rows} label={labelStr || undefined} />
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="none"
                      fill="url(#volumeGradientDash)"
                      isAnimationActive={false}
                      name="Volume"
                    />
                    <Bar
                      dataKey="count"
                      fill="#3B82F6"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                      name="Volume"
                    />
                    <Line
                      type="monotone"
                      dataKey="ma"
                      stroke="#8B5CF6"
                      strokeWidth={3}
                      dot={{ fill: "#8B5CF6", r: 4, strokeWidth: 2, stroke: "#fff" }}
                      activeDot={{ r: 6 }}
                      name="3d MA"
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Search volume bands: day vs 4-day trailing peak (not statistical percentiles). */}
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <h3 className="text-lg font-semibold text-slate-900">
                  Search volume vs recent peak (4 days)
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Marketplace /search only. The{" "}
                  <span className="font-medium text-slate-700">green</span> line is how many searches happened
                  each day. The <span className="font-medium text-slate-700">red</span> line is the highest
                  daily count in a rolling window of <span className="font-medium text-slate-700">today plus
                  the previous three days</span>—so a big spike keeps the “ceiling” visible for a few days after
                  traffic calms down. The <span className="font-medium text-slate-700">amber</span> line is the
                  midpoint between that day&apos;s count and that 4-day peak (a softer read on whether recent
                  traffic is still elevated).
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Not API latency percentiles—only daily search volume from the same series.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  Daily count
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                  <span className="h-2 w-2 rounded-full bg-amber-600" />
                  Mid (day &amp; 4-day peak)
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">
                  <span className="h-2 w-2 rounded-full bg-rose-600" />
                  4-day peak
                </span>
              </div>
            </div>
            {activityBandsData.length === 0 ? (
              <EmptyChart />
            ) : (
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activityBandsData} margin={{ top: 10, right: 10, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="p50g" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="p95g" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="p99g" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.1} />
                        <stop offset="100%" stopColor="#F43F5E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#94A3B8"
                      tick={{ fill: "#64748B", fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: "#E2E8F0" }}
                      tickFormatter={(v) => {
                        try {
                          return format(parseISO(String(v)), "MMM d")
                        } catch {
                          return String(v)
                        }
                      }}
                    />
                    <YAxis
                      stroke="#94A3B8"
                      tick={{ fill: "#64748B", fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: "#E2E8F0" }}
                      label={{
                        value: "Searches",
                        angle: -90,
                        position: "insideLeft",
                        style: { fill: "#64748B", fontSize: 12 },
                      }}
                    />
                    <RechartsTooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const rows = payload.map((p) => ({
                          name: p.name,
                          value: p.value,
                          color: p.color,
                        }))
                        let labelStr = ""
                        if (label != null && label !== "") {
                          try {
                            labelStr = format(parseISO(String(label)), "MMM d, yyyy")
                          } catch {
                            labelStr = String(label)
                          }
                        }
                        return <AnalyticsTooltip active payload={rows} label={labelStr || undefined} />
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="p99"
                      name="4-day peak"
                      stroke="#F43F5E"
                      strokeWidth={2}
                      fill="url(#p99g)"
                    />
                    <Area
                      type="monotone"
                      dataKey="p95"
                      name="Mid (day & 4-day peak)"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      fill="url(#p95g)"
                    />
                    <Area
                      type="monotone"
                      dataKey="p50"
                      name="Daily count"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      fill="url(#p50g)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-900">Health radar</h3>
              <p className="mt-1 text-sm text-slate-500">Normalized scores from live totals</p>
            </div>
            <div className="mx-auto h-[320px] max-w-[360px]">
              {radarRows.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarRows} cx="50%" cy="50%" outerRadius="72%">
                    <defs>
                      <linearGradient id="radarGradientDash" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366F1" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.3} />
                      </linearGradient>
                    </defs>
                    <PolarGrid stroke="#E2E8F0" strokeWidth={1} />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: "#475569", fontSize: 11, fontWeight: 500 }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      tick={{ fill: "#94A3B8", fontSize: 10 }}
                      stroke="#CBD5E1"
                    />
                    <Radar
                      name="Score"
                      dataKey="A"
                      stroke="#6366F1"
                      fill="url(#radarGradientDash)"
                      strokeWidth={2.5}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const row = payload[0].payload as { subject?: string; A?: number }
                        return (
                          <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white shadow-xl">
                            <span className="font-medium">{row.subject}</span>
                            <span className="ml-2 tabular-nums">{row.A}</span>
                          </div>
                        )
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Result count distribution</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Listings attached to each logged search (bucketed)
                </p>
              </div>
              {data.totalSearches < 1 || !distPieRows.some((r) => r.value > 0) ? (
                <EmptyChart />
              ) : (
                <ReportStylePieBlock rows={distPieRows} minLabelPercent={0.06} />
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Backend mix</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Marketplace /search — Elasticsearch vs database fallback for listing search
                </p>
              </div>
              {!backendPieRows.some((r) => r.value > 0) ? (
                <EmptyChart />
              ) : (
                <ReportStylePieBlock rows={backendPieRows} minLabelPercent={0.05} />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Search dropdown picks</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Typeahead row <span className="font-medium text-slate-600">clicks</span> only (nav + sell
                  form). Hovers are counted separately below. Listing strip uses Elasticsearch when configured.
                </p>
                {data.suggestPickTotal > 0 || data.suggestHoverTotal > 0 ? (
                  <p className="mt-2 text-xs tabular-nums text-slate-500">
                    {data.suggestPickTotal.toLocaleString()} clicks ·{" "}
                    {data.suggestHoverTotal.toLocaleString()} hover events
                  </p>
                ) : null}
              </div>
              <div className="h-[min(320px,50vh)] min-h-[220px]">
                {suggestPickChartRows.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ChartContainer
                    config={{
                      picks: {
                        label: "Clicks",
                        color: "hsl(221.2 83.2% 48%)",
                      },
                    }}
                    className="h-full w-full"
                  >
                    <BarChart
                      data={[...suggestPickChartRows].reverse()}
                      layout="vertical"
                      margin={{ left: 4, right: 8, top: 4, bottom: 4 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis type="number" tick={{ fill: "#64748B", fontSize: 12 }} tickLine={false} axisLine={false} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={148}
                        tick={{ fill: "#64748B", fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="var(--color-picks)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Suggest pipeline mix</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Elasticsearch vs database for each <span className="font-medium text-slate-600">click</span>{" "}
                  (not hover)
                </p>
              </div>
              {!suggestTraceChartRows.some((r) => r.count > 0) ? (
                <EmptyChart />
              ) : (
                <ReportStylePieBlock
                  rows={suggestTraceChartRows.map((row, i) => ({
                    name: row.label,
                    value: row.count,
                    fill: REPORT_PIE_PALETTE[i % REPORT_PIE_PALETTE.length],
                  }))}
                  minLabelPercent={0.05}
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Typed prefixes (dropdown clicks)</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Text in the field when the user <span className="font-medium text-slate-600">clicked</span> a
                  suggest row (same index as{" "}
                  <code className="rounded bg-slate-100 px-1 text-[11px]">query_prefix</code>).
                </p>
              </div>
              <div className="h-[min(360px,52vh)] min-h-[220px]">
                {suggestPrefixClickChartRows.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ChartContainer
                    config={{
                      n: { label: "Clicks", color: "hsl(221.2 83.2% 48%)" },
                    }}
                    className="h-full w-full"
                  >
                    <BarChart
                      data={[...suggestPrefixClickChartRows].reverse()}
                      layout="vertical"
                      margin={{ left: 4, right: 8, top: 4, bottom: 4 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                      <YAxis
                        type="category"
                        dataKey="short"
                        width={132}
                        tick={{ fill: "#64748B", fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="var(--color-n)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Typed prefixes (hover dwell)</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Prefix when the pointer rested ~450ms on a row without clicking (exploratory interest; see
                  client constant <code className="rounded bg-slate-100 px-1 text-[11px]">SUGGEST_HOVER_DWELL_MS</code>
                  ).
                </p>
              </div>
              <div className="h-[min(360px,52vh)] min-h-[220px]">
                {suggestPrefixHoverChartRows.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-500">
                    No hover events in this range yet. Hover logging ships with new client builds.
                  </p>
                ) : (
                  <ChartContainer
                    config={{
                      h: { label: "Hovers", color: "hsl(262 83% 52%)" },
                    }}
                    className="h-full w-full"
                  >
                    <BarChart
                      data={[...suggestPrefixHoverChartRows].reverse()}
                      layout="vertical"
                      margin={{ left: 4, right: 8, top: 4, bottom: 4 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                      <YAxis
                        type="category"
                        dataKey="short"
                        width={132}
                        tick={{ fill: "#64748B", fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="var(--color-h)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Listing opens from dropdown</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Clicks on <span className="font-medium text-slate-600">Top listings</span> rows that navigate
                  to a listing (UUID aggregated in Elasticsearch).
                </p>
              </div>
              <div className="h-[min(360px,52vh)] min-h-[220px]">
                {suggestListingClickChartRows.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-500">
                    No listing clicks from the typeahead in this window.
                  </p>
                ) : (
                  <ChartContainer
                    config={{
                      lc: { label: "Clicks", color: "hsl(173 58% 39%)" },
                    }}
                    className="h-full w-full"
                  >
                    <BarChart
                      data={[...suggestListingClickChartRows].reverse()}
                      layout="vertical"
                      margin={{ left: 4, right: 8, top: 4, bottom: 4 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                      <YAxis
                        type="category"
                        dataKey="short"
                        width={140}
                        tick={{ fill: "#64748B", fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="var(--color-lc)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Dropdown hovers by row type</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Same row taxonomy as picks; counts are dwell-based hovers, not clicks.
                </p>
              </div>
              <div className="h-[min(360px,52vh)] min-h-[220px]">
                {suggestHoverKindChartRows.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-500">
                    No hover events in this range yet.
                  </p>
                ) : (
                  <ChartContainer
                    config={{
                      hv: { label: "Hovers", color: "hsl(38 92% 45%)" },
                    }}
                    className="h-full w-full"
                  >
                    <BarChart
                      data={[...suggestHoverKindChartRows].reverse()}
                      layout="vertical"
                      margin={{ left: 4, right: 8, top: 4, bottom: 4 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={148}
                        tick={{ fill: "#64748B", fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="var(--color-hv)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Category scope</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Filtered browse vs open surfboard search
                </p>
              </div>
              {!categoryPieRows.some((r) => r.value > 0) ? (
                <EmptyChart />
              ) : (
                <ReportStylePieBlock rows={categoryPieRows} minLabelPercent={0.05} />
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Top category slugs</h3>
                <p className="mt-1 text-sm text-slate-500">When a category filter was present</p>
              </div>
              <div className="h-[180px]">
                {!(data.topCategorySlugs?.length) ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    No category-tagged searches in this window.
                  </p>
                ) : (
                  <ChartContainer
                    config={{
                      c: {
                        label: "Searches",
                        color: "hsl(173 58% 39%)",
                      },
                    }}
                    className="h-full w-full"
                  >
                    <BarChart
                      data={[...data.topCategorySlugs].reverse()}
                      layout="vertical"
                      margin={{ left: 4, right: 8, top: 4, bottom: 4 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis type="number" tickLine={false} axisLine={false} />
                      <YAxis
                        type="category"
                        dataKey="slug"
                        width={100}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10, fill: "#64748B" }}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="var(--color-c)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-900">Trending momentum</h3>
              <p className="mt-1 text-sm text-slate-500">Recent volume vs velocity (2-day windows)</p>
            </div>
            <div className="h-[300px]">
              {trendingScatter.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">
                  Not enough overlapping windows yet for a scatter plot.
                </p>
              ) : (
                <ChartContainer
                  config={{
                    recent: { label: "Recent (2d)", color: ACCENT.primary },
                  }}
                  className="h-full w-full"
                >
                  <ScatterChart margin={{ top: 12, right: 12, bottom: 12, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis
                      type="number"
                      dataKey="recent"
                      name="Recent"
                      tick={{ fill: "#64748B", fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      label={{ value: "Recent searches (2d)", position: "bottom", offset: 0, fontSize: 11, fill: "#64748B" }}
                    />
                    <YAxis
                      type="number"
                      dataKey="velocity"
                      name="Velocity"
                      tick={{ fill: "#64748B", fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      label={{
                        value: "Velocity",
                        angle: -90,
                        position: "insideLeft",
                        fontSize: 11,
                        fill: "#64748B",
                      }}
                    />
                    <ZAxis type="number" dataKey="recent" range={[80, 400]} />
                    <RechartsTooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const row = payload[0].payload as {
                          query?: string
                          recent?: number
                          velocity?: number
                        }
                        return (
                          <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white shadow-xl">
                            <p className="max-w-[200px] break-words font-medium">{row.query}</p>
                            <p className="mt-1 text-slate-300 tabular-nums">
                              Recent {row.recent} · v {row.velocity}
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Scatter data={trendingScatter} fill={ACCENT.primary} fillOpacity={0.75} />
                  </ScatterChart>
                </ChartContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Top normalized queries</h3>
                <p className="mt-1 text-sm text-slate-500">Rank-ordered terms in Elasticsearch</p>
              </div>
              <div className="pl-0">
                {topBarData.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ChartContainer
                    config={{
                      count: {
                        label: "Searches",
                        color: "hsl(221.2 83.2% 48%)",
                      },
                    }}
                    className="h-[min(440px,62vh)] w-full"
                  >
                    <BarChart
                      data={[...topBarData].reverse()}
                      layout="vertical"
                      margin={{ left: 4, right: 16, top: 8, bottom: 8 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis type="number" tickLine={false} axisLine={false} />
                      <YAxis
                        type="category"
                        dataKey="short"
                        width={112}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: "#64748B" }}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="var(--color-count)" />
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Trending detail</h3>
                <p className="mt-1 text-sm text-slate-500">2-day vs prior 2-day velocity</p>
              </div>
              {data.trendingQueries.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  Needs more recent searches to compute momentum.
                </p>
              ) : (
                <div className="max-h-[440px] overflow-x-auto overflow-y-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
                      <tr className="text-left text-slate-500">
                        <th className="p-2 font-medium">Query</th>
                        <th className="p-2 text-right font-medium">Recent</th>
                        <th className="p-2 text-right font-medium">Prior</th>
                        <th className="p-2 text-right font-medium">v</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.trendingQueries.map((row) => (
                        <tr key={row.query} className="border-b border-slate-100 last:border-0">
                          <td className="max-w-[200px] truncate p-2" title={row.query}>
                            {row.query}
                          </td>
                          <td className="p-2 text-right tabular-nums">{row.recentCount}</td>
                          <td className="p-2 text-right tabular-nums text-slate-500">
                            {row.previousCount}
                          </td>
                          <td className="p-2 text-right font-medium tabular-nums">
                            {row.velocity.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  All‑time &amp; monthly trending detail
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Marketplace queries only · same momentum rules as the short-window table above.&nbsp;
                  <span className="text-slate-600">
                    {periodTrendMode === "all"
                      ? "All-time compares the later half of stored history versus the earlier half."
                      : "Monthly compares that month to the immediately prior calendar month (UTC). Choose a Year, then Month."}
                  </span>
                </p>
                {periodTrendPayload &&
                periodTrendPayload.configured &&
                !periodTrendShowSpinner &&
                !periodTrendError ? (
                  <p className="mt-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">Recent window:</span>{" "}
                    {periodTrendPayload.recentLabel}{" "}
                    <span className="mx-1 text-slate-400">·</span>
                    <span className="font-medium text-slate-700">Prior window:</span>{" "}
                    {periodTrendPayload.priorLabel}
                  </p>
                ) : null}
              </div>
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end">
                <div className="flex flex-col gap-1.5 sm:min-w-[200px]">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Period
                  </span>
                  <Select
                    value={periodTrendMode}
                    onValueChange={(v) =>
                      setPeriodTrendMode(v as "all" | "month")
                    }
                  >
                    <SelectTrigger className="h-9 border-slate-200 bg-white sm:w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        All time (later vs earlier half)
                      </SelectItem>
                      <SelectItem value="month">Calendar month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {periodTrendMode === "month" ? (
                  <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
                    <div className="flex flex-col gap-1.5 sm:min-w-[110px]">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Year
                      </span>
                      {periodYearChoicesDescending.length === 0 ? (
                        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                          No years available in the rolling window (UTC).
                        </p>
                      ) : (
                        <Select value={periodTrendYearUtc} onValueChange={setPeriodTrendYearUtc}>
                          <SelectTrigger className="h-9 border-slate-200 bg-white sm:w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {periodYearChoicesDescending.map((year) => (
                              <SelectItem key={year} value={String(year)}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 sm:min-w-[150px]">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Month
                      </span>
                      <Select value={periodTrendMonthUtc} onValueChange={setPeriodTrendMonthUtc}>
                        <SelectTrigger className="h-9 border-slate-200 bg-white sm:w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UTC_CALENDAR_MONTH_NUMBERS.map((monthNum) => {
                            const mStr = String(monthNum).padStart(2, "0")
                            return (
                              <SelectItem key={mStr} value={mStr}>
                                {formatUtcMonthName(monthNum)}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-col gap-1.5 sm:min-w-[200px]">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Sort rows
                  </span>
                  <Select
                    value={periodTrendSort}
                    onValueChange={(v) =>
                      setPeriodTrendSort(v as PeriodTrendSortKey)
                    }
                  >
                    <SelectTrigger className="h-9 border-slate-200 bg-white sm:w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIOD_TREND_SORT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {periodTrendShowSpinner ? (
              <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading period trending detail…
              </div>
            ) : periodTrendError ? (
              <p className="py-6 text-center text-sm text-destructive" role="alert">
                {periodTrendError}
              </p>
            ) : periodTrendRowsSorted.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                Not enough overlapping volume yet for these windows. Try another month or check back
                after more searches accumulate.
              </p>
            ) : (
              <div className="max-h-[440px] overflow-x-auto overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
                    <tr className="text-left text-slate-500">
                      <th className="p-2 font-medium">Query</th>
                      <th className="p-2 text-right font-medium">Recent</th>
                      <th className="p-2 text-right font-medium">Prior</th>
                      <th className="p-2 text-right font-medium">v</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodTrendRowsSorted.map((row) => (
                      <tr key={row.query} className="border-b border-slate-100 last:border-0">
                        <td className="max-w-[200px] truncate p-2" title={row.query}>
                          {row.query}
                        </td>
                        <td className="p-2 text-right tabular-nums">{row.recentCount}</td>
                        <td className="p-2 text-right tabular-nums text-slate-500">
                          {row.previousCount}
                        </td>
                        <td className="p-2 text-right font-medium tabular-nums">
                          {row.velocity.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-900">Zero-result demand</h3>
              <p className="mt-1 text-sm text-slate-500">
                Queries that logged zero listings — prioritize content or synonyms here
              </p>
            </div>
            {data.zeroResultQueries.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">
                No zero-result events in this range.
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="max-h-[300px] overflow-x-auto overflow-y-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
                      <tr className="text-left text-slate-500">
                        <th className="p-2 font-medium">Query</th>
                        <th className="p-2 text-right font-medium">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.zeroResultQueries.map((row) => (
                        <tr key={row.query} className="border-b border-slate-100 last:border-0">
                          <td className="max-w-[240px] truncate p-2" title={row.query}>
                            {row.query}
                          </td>
                          <td className="p-2 text-right tabular-nums">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="h-[280px]">
                  <ChartContainer
                    config={{
                      count: {
                        label: "Zero-result",
                        color: "hsl(350 80% 48%)",
                      },
                    }}
                    className="h-full w-full"
                  >
                    <BarChart
                      data={data.zeroResultQueries.slice(0, 12).map((row) => ({
                        ...row,
                        short: truncateQuery(row.query, 18),
                      }))}
                      margin={{ left: 8, right: 8, top: 8, bottom: 48 }}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis
                        dataKey="short"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        angle={-28}
                        textAnchor="end"
                        height={52}
                        interval={0}
                        tick={{ fontSize: 10, fill: "#64748B" }}
                      />
                      <YAxis tickLine={false} axisLine={false} width={32} tick={{ fill: "#64748B" }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--color-count)" />
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>
            )}
          </div>

          <Separator className="bg-slate-200" />

          {data.fetchedAt && (
            <p className="text-center text-xs text-slate-500">
              Fetched {formatDistanceToNow(new Date(data.fetchedAt), { addSuffix: true })}
              {data.from && data.to ? (
                <>
                  {" "}
                  · window {format(parseISO(data.from), "MMM d")} –{" "}
                  {format(parseISO(data.to), "MMM d, yyyy")}
                </>
              ) : null}
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}

function EmptyChart() {
  return (
    <p className="text-sm text-muted-foreground py-12 text-center">
      No events in this range. Run keyword searches on the marketplace, then refresh.
    </p>
  )
}
