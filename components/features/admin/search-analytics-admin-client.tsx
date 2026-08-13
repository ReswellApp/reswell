"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
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
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  ExternalLink,
  Lightbulb,
  ListChecks,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Undo2,
  User,
  Wand2,
  X,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  SearchAnalyticsHeadline,
  SearchInsight,
  SearchInsightSeverity,
  SearchTrendPeriodDetailPayload,
  SearchTrendPeriodMode,
} from "@/lib/services/searchAnalytics"
import { SEARCH_TREND_WINDOW_DAYS } from "@/lib/validations/search-analytics"
import { cn } from "@/lib/utils"

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const

type PeriodTrendSortKey = "velocity" | "recent" | "prior" | "query"

/** Composite select value -> (mode, windowDays). Window options come first as the most intuitive. */
type PeriodTrendChoice = {
  value: string
  label: string
  group: "Rolling comparison" | "Fixed period"
  mode: SearchTrendPeriodMode
  windowDays?: number
}

const PERIOD_TREND_CHOICES: PeriodTrendChoice[] = [
  ...SEARCH_TREND_WINDOW_DAYS.map(
    (d): PeriodTrendChoice => ({
      value: `window:${d}`,
      label: `Last ${d} days vs prior ${d}`,
      group: "Rolling comparison",
      mode: "window",
      windowDays: d,
    }),
  ),
  { value: "month", label: "Specific calendar month", group: "Fixed period", mode: "month" },
  { value: "all", label: "All time (later vs earlier half)", group: "Fixed period", mode: "all" },
]

const PERIOD_TREND_DEFAULT_WINDOW = 30

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

/** Mon→Sun ordering for the day-of-week pattern (week starts Monday). */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

/** Weekday index (0=Sun) for a "YYYY-MM-DD" bucket, read as a calendar date. */
function weekdayIndexForBucket(dateIso: string): number {
  const [y, m, d] = dateIso.split("-").map(Number)
  if (!y || !m || !d) return new Date(dateIso).getDay()
  return new Date(y, m - 1, d).getDay()
}

/** "0".."23" hour → "12a", "1a", … "12p", "11p". */
function formatHourLabel(hour: number): string {
  const period = hour < 12 ? "a" : "p"
  const base = hour % 12 === 0 ? 12 : hour % 12
  return `${base}${period}`
}

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

function navPickKindLabel(kind: string): string {
  const labels: Record<string, string> = {
    top_listing: "Top listing",
    brand_strip: "Brand strip",
    brand_row: "Brand row",
    category_chip: "Category chip",
    suggestion_title: "Title suggestion",
    suggestion_brand: "Brand suggestion",
    suggestion_category: "Category suggestion",
    view_all_results: "View all results",
    brand_catalog: "Brand catalog",
  }
  return labels[kind] ?? kind.replace(/_/g, " ")
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

// ---------------------------------------------------------------------------
// PRO: "What matters" headline strip + Insights & recommended-actions panel
// ---------------------------------------------------------------------------

function fmtPct(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—"
  return `${(n * 100).toFixed(digits)}%`
}

function HeadlineStrip({ headline }: { headline: SearchAnalyticsHeadline }) {
  const momentum = headline.volumeMomentum
  const items: {
    label: string
    value: string
    hint: string
    tone: "emerald" | "rose" | "amber" | "slate" | "blue"
    icon: ReactNode
  }[] = [
    {
      label: "Unmet demand",
      value: headline.unmetDemandSearches.toLocaleString(),
      hint: "Searches that hit zero results",
      tone: headline.unmetDemandSearches > 0 ? "amber" : "emerald",
      icon: <Zap className="h-4 w-4" />,
    },
    {
      label: "Volume momentum",
      value:
        momentum == null
          ? "—"
          : `${momentum >= 0 ? "+" : "-"}${fmtPct(Math.abs(momentum))}`,
      hint: "2nd half vs 1st half of range",
      tone: momentum == null ? "slate" : momentum >= 0 ? "emerald" : "rose",
      icon:
        momentum != null && momentum < 0 ? (
          <TrendingDown className="h-4 w-4" />
        ) : (
          <TrendingUp className="h-4 w-4" />
        ),
    },
    {
      label: "Typeahead use",
      value: fmtPct(headline.typeaheadEngagementRate),
      hint: "Searches ending in a suggestion click",
      tone: "blue",
      icon: <Sparkles className="h-4 w-4" />,
    },
    {
      label: "DB fallback",
      value: fmtPct(headline.databaseFallbackShare),
      hint: "Served by database vs Elasticsearch",
      tone:
        headline.databaseFallbackShare != null && headline.databaseFallbackShare >= 0.25
          ? "rose"
          : "slate",
      icon: <AlertTriangle className="h-4 w-4" />,
    },
  ]

  const toneMap: Record<string, string> = {
    emerald: "text-emerald-600 bg-emerald-50",
    rose: "text-rose-600 bg-rose-50",
    amber: "text-amber-600 bg-amber-50",
    blue: "text-blue-600 bg-blue-50",
    slate: "text-slate-600 bg-slate-100",
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg",
                toneMap[it.tone],
              )}
            >
              {it.icon}
            </span>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {it.label}
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{it.value}</div>
          <p className="mt-0.5 text-xs text-slate-500">{it.hint}</p>
        </div>
      ))}
    </div>
  )
}

const SEVERITY_STYLES: Record<
  SearchInsightSeverity,
  { ring: string; chip: string; label: string; icon: ReactNode }
> = {
  critical: {
    ring: "border-rose-200 bg-rose-50/40",
    chip: "bg-rose-100 text-rose-700",
    label: "Critical",
    icon: <AlertTriangle className="h-4 w-4 text-rose-600" />,
  },
  warning: {
    ring: "border-amber-200 bg-amber-50/40",
    chip: "bg-amber-100 text-amber-700",
    label: "Needs attention",
    icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
  },
  opportunity: {
    ring: "border-blue-200 bg-blue-50/40",
    chip: "bg-blue-100 text-blue-700",
    label: "Opportunity",
    icon: <Lightbulb className="h-4 w-4 text-blue-600" />,
  },
  positive: {
    ring: "border-emerald-200 bg-emerald-50/40",
    chip: "bg-emerald-100 text-emerald-700",
    label: "Healthy",
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  },
}

// ---------------------------------------------------------------------------
// Insight action workflow — team-shared status (Supabase) + deep-link actions
// ---------------------------------------------------------------------------

type InsightStatus = "open" | "in_progress" | "snoozed" | "done" | "dismissed"

/** Mirrors SearchInsightActionDto from the API (shared across all staff). */
type InsightActionRecord = {
  insightId: string
  status: InsightStatus
  snoozeUntil: string | null
  assigneeId: string | null
  dueDate: string | null
  note: string | null
  updatedBy: string | null
  updatedAt: string
}

type InsightAssignee = { id: string; name: string }
type InsightActionMap = Record<string, InsightActionRecord>

const INSIGHT_SNOOZE_DAYS = 7

type InsightActionPatch = Partial<
  Pick<InsightActionRecord, "status" | "snoozeUntil" | "assigneeId" | "dueDate" | "note">
>

/** Team-shared persistence via the admin API (every staff member sees the same state). */
function useInsightActions() {
  const [map, setMap] = useState<InsightActionMap>({})
  const [assignees, setAssignees] = useState<InsightAssignee[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/admin/search-analytics/insight-actions", {
          credentials: "include",
        })
        const body = await res.json().catch(() => ({}))
        if (cancelled || !res.ok) {
          if (!cancelled) setHydrated(true)
          return
        }
        const actions = (body?.data?.actions ?? []) as InsightActionRecord[]
        const next: InsightActionMap = {}
        for (const a of actions) next[a.insightId] = a
        setMap(next)
        setAssignees((body?.data?.assignees ?? []) as InsightAssignee[])
      } catch {
        // Leave map empty; cards default to "open".
      } finally {
        if (!cancelled) setHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /** Optimistic merge + persist. `status: "open"` with no metadata clears the row. */
  const update = useCallback(
    (insightId: string, patch: InsightActionPatch) => {
      setSaveError(null)
      let optimistic: InsightActionRecord | null = null

      setMap((prev) => {
        const current: InsightActionRecord = prev[insightId] ?? {
          insightId,
          status: "open",
          snoozeUntil: null,
          assigneeId: null,
          dueDate: null,
          note: null,
          updatedBy: null,
          updatedAt: new Date().toISOString(),
        }
        const merged: InsightActionRecord = {
          ...current,
          ...patch,
          insightId,
          updatedAt: new Date().toISOString(),
        }
        optimistic = merged
        const isCleanReset =
          merged.status === "open" &&
          !merged.snoozeUntil &&
          !merged.assigneeId &&
          !merged.dueDate &&
          !merged.note
        const next = { ...prev }
        if (isCleanReset) delete next[insightId]
        else next[insightId] = merged
        return next
      })

      if (!optimistic) return
      const payload = optimistic as InsightActionRecord
      void (async () => {
        try {
          const res = await fetch("/api/admin/search-analytics/insight-actions", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              insightId: payload.insightId,
              status: payload.status,
              snoozeUntil: payload.snoozeUntil,
              assigneeId: payload.assigneeId,
              dueDate: payload.dueDate,
              note: payload.note,
            }),
          })
          if (!res.ok) setSaveError("Couldn't sync that change — it may not be saved.")
        } catch {
          setSaveError("Couldn't sync that change — it may not be saved.")
        }
      })()
    },
    [],
  )

  const setStatus = useCallback(
    (id: string, status: InsightStatus) => {
      if (status === "open") {
        update(id, { status: "open", snoozeUntil: null })
        return
      }
      const patch: InsightActionPatch = { status }
      patch.snoozeUntil =
        status === "snoozed"
          ? new Date(Date.now() + INSIGHT_SNOOZE_DAYS * 86_400_000).toISOString()
          : null
      update(id, patch)
    },
    [update],
  )

  const setAssignee = useCallback(
    (id: string, assigneeId: string | null) => update(id, { assigneeId }),
    [update],
  )
  const setDueDate = useCallback(
    (id: string, dueDate: string | null) => update(id, { dueDate }),
    [update],
  )

  return { map, assignees, hydrated, saveError, setStatus, setAssignee, setDueDate }
}

/** A future-dated snooze collapses back to "open" once its timer elapses. */
function effectiveInsightStatus(record: InsightActionRecord | undefined): InsightStatus {
  if (!record) return "open"
  if (
    record.status === "snoozed" &&
    record.snoozeUntil &&
    Date.parse(record.snoozeUntil) <= Date.now()
  ) {
    return "open"
  }
  return record.status
}

/** Strip a trailing " (1,234)" volume suffix from an insight example chip. */
function stripExampleCount(example: string): string {
  return example.replace(/\s*\(\d[\d,]*(?:\.\d+)?[×x]?[^)]*\)\s*$/, "").trim()
}

/** Best single query to preview on /search for this insight, if any. */
function primaryQueryForInsight(insight: SearchInsight): string | null {
  const quoted = insight.title.match(/[“"']([^”"']+)[”"']/)
  if (quoted?.[1]?.trim()) return quoted[1].trim()
  const first = insight.examples?.[0]
  if (first) {
    const stripped = stripExampleCount(first)
    if (stripped) return stripped
  }
  return null
}

/** Plain query terms for copy/export (counts removed). */
function insightCopyTerms(insight: SearchInsight): string[] {
  const fromExamples = (insight.examples ?? [])
    .map(stripExampleCount)
    .filter(Boolean)
  if (fromExamples.length > 0) return fromExamples
  const primary = primaryQueryForInsight(insight)
  return primary ? [primary] : []
}

const INSIGHT_STATUS_BADGE: Record<
  Exclude<InsightStatus, "open">,
  { label: string; className: string }
> = {
  in_progress: { label: "In progress", className: "bg-blue-100 text-blue-700" },
  snoozed: { label: "Snoozed", className: "bg-slate-200 text-slate-600" },
  done: { label: "Done", className: "bg-emerald-100 text-emerald-700" },
  dismissed: { label: "Dismissed", className: "bg-slate-200 text-slate-500" },
}

type AsyncActionState = "idle" | "loading" | "done" | "error"

function InsightCard({
  insight,
  record,
  status,
  assignees,
  onSetStatus,
  onSetAssignee,
  onSetDueDate,
}: {
  insight: SearchInsight
  record: InsightActionRecord | undefined
  status: InsightStatus
  assignees: InsightAssignee[]
  onSetStatus: (id: string, status: InsightStatus) => void
  onSetAssignee: (id: string, assigneeId: string | null) => void
  onSetDueDate: (id: string, dueDate: string | null) => void
}) {
  const s = SEVERITY_STYLES[insight.severity]
  const [copied, setCopied] = useState(false)
  const [bmrState, setBmrState] = useState<AsyncActionState>("idle")
  const [synonymOpen, setSynonymOpen] = useState(false)
  const [synonymTarget, setSynonymTarget] = useState("")
  const [synonymState, setSynonymState] = useState<AsyncActionState>("idle")

  const query = primaryQueryForInsight(insight)
  const terms = insightCopyTerms(insight)
  const showCatalog =
    insight.category === "inventory" || insight.id === "brand-directory-unmet"
  const showSettings = insight.category === "infrastructure"
  /** Query-driven insights where rewriting a dead-end term to real inventory helps. */
  const showSynonym =
    Boolean(query) &&
    ["demand", "inventory", "relevance", "growth"].includes(insight.category)
  const resolved = status === "done" || status === "dismissed"
  const badge = status !== "open" ? INSIGHT_STATUS_BADGE[status] : null

  const openInNewTab = (href: string) => {
    window.open(href, "_blank", "noopener,noreferrer")
  }

  const copyTerms = async () => {
    if (terms.length === 0) return
    try {
      await navigator.clipboard.writeText(terms.join("\n"))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard blocked — no-op.
    }
  }

  const queueBrandModelRequest = async () => {
    if (!query || bmrState === "loading") return
    setBmrState("loading")
    try {
      const res = await fetch("/api/admin/search-analytics/brand-model-request", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, insightId: insight.id }),
      })
      setBmrState(res.ok ? "done" : "error")
    } catch {
      setBmrState("error")
    }
  }

  const saveSynonym = async () => {
    const target = synonymTarget.trim()
    if (!query || !target || synonymState === "loading") return
    setSynonymState("loading")
    try {
      // Uses the existing search-curation synonyms system (term → expansions),
      // which the live marketplace search path already reads via expandSearchQueryTerms.
      const res = await fetch("/api/admin/search-curation/synonyms", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: query, expansions: [target], enabled: true }),
      })
      if (res.ok) {
        setSynonymState("done")
        window.setTimeout(() => setSynonymOpen(false), 1200)
      } else {
        setSynonymState("error")
      }
    } catch {
      setSynonymState("error")
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border p-4 shadow-sm transition-opacity",
        s.ring,
        resolved && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 shrink-0">{s.icon}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4
                className={cn(
                  "text-sm font-semibold text-slate-900",
                  resolved && "line-through decoration-slate-400",
                )}
              >
                {insight.title}
              </h4>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  s.chip,
                )}
              >
                {s.label}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {insight.category}
              </span>
              {badge ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    badge.className,
                  )}
                >
                  {badge.label}
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-sm text-slate-600">{insight.finding}</p>
          </div>
        </div>
        {insight.metricValue ? (
          <div className="shrink-0 text-right">
            <div className="text-lg font-bold tabular-nums text-slate-900">
              {insight.metricValue}
            </div>
            {insight.metricLabel ? (
              <div className="text-[10px] uppercase tracking-wide text-slate-400">
                {insight.metricLabel}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {insight.examples && insight.examples.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {insight.examples.map((ex) => (
            <span
              key={ex}
              className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600"
            >
              {ex}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex items-start gap-2 rounded-lg bg-white/70 p-2.5 ring-1 ring-inset ring-slate-200/70">
        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        <p className="text-sm text-slate-700">
          <span className="font-semibold text-slate-900">Do this: </span>
          {insight.action}
        </p>
      </div>

      {insight.impact ? (
        <p className="mt-2 pl-1 text-xs italic text-slate-500">{insight.impact}</p>
      ) : null}

      {/* Take action — deep links + copy */}
      {(query || showCatalog || showSettings || terms.length > 0) && status !== "dismissed" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {query ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-slate-200 bg-white text-xs"
              onClick={() => openInNewTab(`/search?q=${encodeURIComponent(query)}`)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View “{truncateQuery(query, 18)}” in search
            </Button>
          ) : null}
          {showCatalog ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-slate-200 bg-white text-xs"
              onClick={() => openInNewTab("/admin/catalog-overview")}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Brand catalog
            </Button>
          ) : null}
          {showSettings ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-slate-200 bg-white text-xs"
              onClick={() => openInNewTab("/admin/settings")}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open settings
            </Button>
          ) : null}
          {terms.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-slate-200 bg-white text-xs"
              onClick={copyTerms}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : `Copy ${terms.length === 1 ? "term" : `${terms.length} terms`}`}
            </Button>
          ) : null}
          {showCatalog && query ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-slate-200 bg-white text-xs"
              onClick={queueBrandModelRequest}
              disabled={bmrState === "loading" || bmrState === "done"}
            >
              {bmrState === "loading" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : bmrState === "done" ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <ClipboardList className="h-3.5 w-3.5" />
              )}
              {bmrState === "done"
                ? "Queued"
                : bmrState === "error"
                  ? "Retry queue"
                  : "Queue catalog request"}
            </Button>
          ) : null}
          {showSynonym ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-slate-200 bg-white text-xs"
              onClick={() => setSynonymOpen((v) => !v)}
            >
              <Wand2 className="h-3.5 w-3.5" />
              Add synonym
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* One-click synonym — rewrite the dead-end term to one with inventory */}
      {showSynonym && synonymOpen && status !== "dismissed" ? (
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <p className="text-xs text-slate-600">
            When shoppers search{" "}
            <span className="font-semibold text-slate-800">“{query}”</span>, run this query
            instead:
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={synonymTarget}
              onChange={(e) => setSynonymTarget(e.target.value)}
              placeholder="e.g. fish surfboard"
              className="h-8 min-w-[160px] flex-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none focus:border-slate-400"
            />
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={saveSynonym}
              disabled={!synonymTarget.trim() || synonymState === "loading"}
            >
              {synonymState === "loading" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : synonymState === "done" ? (
                <Check className="h-3.5 w-3.5" />
              ) : null}
              {synonymState === "done" ? "Mapped" : "Save synonym"}
            </Button>
          </div>
          {synonymState === "error" ? (
            <p className="mt-1.5 text-xs text-rose-600">Couldn’t save. Check the target query.</p>
          ) : null}
        </div>
      ) : null}

      {/* Track — status workflow + assignment */}
      <div className="mt-3 space-y-2 border-t border-slate-200/70 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        {status === "snoozed" && record?.snoozeUntil ? (
          <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            Snoozed until{" "}
            {(() => {
              try {
                return format(parseISO(record.snoozeUntil), "MMM d")
              } catch {
                return "later"
              }
            })()}
          </span>
        ) : null}
        {resolved ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-slate-600"
            onClick={() => onSetStatus(insight.id, "open")}
          >
            <Undo2 className="h-3.5 w-3.5" />
            Reopen
          </Button>
        ) : (
          <>
            {status !== "in_progress" ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs text-blue-700 hover:bg-blue-50"
                onClick={() => onSetStatus(insight.id, "in_progress")}
              >
                <Play className="h-3.5 w-3.5" />
                Start
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-emerald-700 hover:bg-emerald-50"
              onClick={() => onSetStatus(insight.id, "done")}
            >
              <Check className="h-3.5 w-3.5" />
              Mark done
            </Button>
            {status !== "snoozed" ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs text-slate-600"
                onClick={() => onSetStatus(insight.id, "snoozed")}
              >
                <Clock className="h-3.5 w-3.5" />
                Snooze {INSIGHT_SNOOZE_DAYS}d
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs text-slate-600"
                onClick={() => onSetStatus(insight.id, "open")}
              >
                <Undo2 className="h-3.5 w-3.5" />
                Unsnooze
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-slate-500 hover:text-rose-600"
              onClick={() => onSetStatus(insight.id, "dismissed")}
            >
              <X className="h-3.5 w-3.5" />
              Dismiss
            </Button>
          </>
        )}
      </div>
        {status !== "dismissed" ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
              <User className="h-3.5 w-3.5" />
              Owner
            </span>
            <Select
              value={record?.assigneeId ?? "unassigned"}
              onValueChange={(v) =>
                onSetAssignee(insight.id, v === "unassigned" ? null : v)
              }
            >
              <SelectTrigger className="h-8 w-[170px] border-slate-200 bg-white text-xs">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {assignees.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-1 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              Due
            </span>
            <input
              type="date"
              value={record?.dueDate ?? ""}
              onChange={(e) => onSetDueDate(insight.id, e.target.value || null)}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-slate-400"
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function TrendStatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint: string
  tone: "violet" | "emerald" | "blue" | "amber"
}) {
  const toneMap: Record<string, string> = {
    violet: "text-violet-600",
    emerald: "text-emerald-600",
    blue: "text-blue-600",
    amber: "text-amber-600",
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cn("mt-1 text-2xl font-bold tabular-nums", toneMap[tone])}>{value}</div>
      <p className="mt-0.5 truncate text-xs text-slate-500" title={hint}>
        {hint}
      </p>
    </div>
  )
}

type InsightFilter = "todo" | "snoozed" | "done" | "dismissed" | "all"

const INSIGHT_FILTER_TABS: { value: InsightFilter; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "snoozed", label: "Snoozed" },
  { value: "done", label: "Done" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All" },
]

function InsightsPanel({ insights }: { insights: SearchInsight[] }) {
  const { map, assignees, hydrated, saveError, setStatus, setAssignee, setDueDate } =
    useInsightActions()
  const [filter, setFilter] = useState<InsightFilter>("todo")

  const withStatus = useMemo(
    () =>
      insights.map((insight) => {
        const record = map[insight.id]
        return { insight, record, status: effectiveInsightStatus(record) }
      }),
    [insights, map],
  )

  const counts = useMemo(() => {
    const c = { todo: 0, snoozed: 0, done: 0, dismissed: 0, all: withStatus.length }
    for (const { status } of withStatus) {
      if (status === "open" || status === "in_progress") c.todo += 1
      else if (status === "snoozed") c.snoozed += 1
      else if (status === "done") c.done += 1
      else if (status === "dismissed") c.dismissed += 1
    }
    return c
  }, [withStatus])

  /** Outstanding work = non-healthy items still open or in progress. */
  const actionable = useMemo(
    () =>
      withStatus.filter(
        ({ insight, status }) =>
          insight.severity !== "positive" &&
          (status === "open" || status === "in_progress"),
      ).length,
    [withStatus],
  )

  const visible = useMemo(() => {
    return withStatus.filter(({ status }) => {
      switch (filter) {
        case "todo":
          return status === "open" || status === "in_progress"
        case "snoozed":
          return status === "snoozed"
        case "done":
          return status === "done"
        case "dismissed":
          return status === "dismissed"
        default:
          return true
      }
    })
  }, [withStatus, filter])

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
            <Lightbulb className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Insights &amp; recommended actions</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              Automated read of what the data is telling you — act on each one and track it to done.
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
            actionable > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700",
          )}
        >
          <ListChecks className="h-3.5 w-3.5" />
          {actionable} action{actionable === 1 ? "" : "s"} to take
        </span>
      </div>

      {insights.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-6 py-3">
          {INSIGHT_FILTER_TABS.map((tab) => {
            const count = counts[tab.value]
            const active = filter === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilter(tab.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                    active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500",
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="p-6">
        {insights.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-6 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Nothing needs attention right now — search demand and inventory look well matched.
          </div>
        ) : visible.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-600">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {filter === "todo"
              ? "No open items — everything here has been actioned, snoozed, or dismissed."
              : `No ${filter} insights.`}
          </div>
        ) : (
          <div
            className={cn(
              "grid grid-cols-1 gap-4 lg:grid-cols-2",
              !hydrated && "opacity-90",
            )}
          >
            {visible.map(({ insight, record, status }) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                record={record}
                status={status}
                assignees={assignees}
                onSetStatus={setStatus}
                onSetAssignee={setAssignee}
                onSetDueDate={setDueDate}
              />
            ))}
          </div>
        )}
        {saveError ? (
          <p className="mt-3 text-xs text-rose-600" role="alert">
            {saveError}
          </p>
        ) : null}
      </div>
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

  const [periodTrendMode, setPeriodTrendMode] = useState<SearchTrendPeriodMode>("window")
  const [periodTrendWindowDays, setPeriodTrendWindowDays] = useState<number>(
    PERIOD_TREND_DEFAULT_WINDOW,
  )
  const [periodTrendYearUtc, setPeriodTrendYearUtc] = useState(() =>
    splitYm(defaultUtcPriorMonthYm()).yStr)
  const [periodTrendMonthUtc, setPeriodTrendMonthUtc] = useState(() =>
    splitYm(defaultUtcPriorMonthYm()).mStr)

  const periodTrendSelectValue =
    periodTrendMode === "window" ? `window:${periodTrendWindowDays}` : periodTrendMode

  const onPeriodTrendChange = useCallback((value: string) => {
    const choice = PERIOD_TREND_CHOICES.find((c) => c.value === value)
    if (!choice) return
    setPeriodTrendMode(choice.mode)
    if (choice.mode === "window" && choice.windowDays) {
      setPeriodTrendWindowDays(choice.windowDays)
    }
  }, [])

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
        : periodTrendMode === "window"
          ? `mode=window&windowDays=${periodTrendWindowDays}`
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
  }, [data?.configured, periodTrendMode, periodTrendMonthYm, periodTrendWindowDays])

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

  const periodTrendStats = useMemo(() => {
    const rows = periodTrendPayload?.trendingQueries ?? []
    const newEntrants = rows.filter((r) => r.previousCount === 0).length
    const maxRecent = rows.reduce((m, r) => Math.max(m, r.recentCount), 0)
    const recentVolume = rows.reduce((s, r) => s + r.recentCount, 0)
    const topMover = rows.reduce<(typeof rows)[number] | null>(
      (best, r) => (best == null || r.velocity > best.velocity ? r : best),
      null,
    )
    return { count: rows.length, newEntrants, maxRecent, recentVolume, topMover }
  }, [periodTrendPayload?.trendingQueries])

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

  // --- "Searches per day" detailed breakdown + time-pattern analytics --------
  const dailyBreakdownRows = useMemo(() => {
    const rows = data?.volumeByDay ?? []
    const total = rows.reduce((s, r) => s + r.count, 0)
    return rows.map((row, i) => {
      const prev = i > 0 ? rows[i - 1].count : null
      const deltaPct =
        prev != null && prev > 0
          ? ((row.count - prev) / prev) * 100
          : prev === 0 && row.count > 0
            ? 100
            : null
      return {
        date: row.date,
        count: row.count,
        weekdayLong: WEEKDAY_LONG[weekdayIndexForBucket(row.date)],
        sharePct: total > 0 ? (row.count / total) * 100 : 0,
        deltaPct,
      }
    })
  }, [data?.volumeByDay])

  const dailySummary = useMemo(() => {
    const rows = data?.volumeByDay ?? []
    if (rows.length === 0) return null
    const total = rows.reduce((s, r) => s + r.count, 0)
    const activeDays = rows.filter((r) => r.count > 0)
    const busiest = rows.reduce((b, r) => (r.count > b.count ? r : b), rows[0])
    const quietestActive =
      activeDays.length > 0
        ? activeDays.reduce((q, r) => (r.count < q.count ? r : q), activeDays[0])
        : null
    return {
      total,
      avgPerDay: total / rows.length,
      avgPerActiveDay: activeDays.length > 0 ? total / activeDays.length : 0,
      busiest,
      quietestActive,
      activeDayCount: activeDays.length,
      dayCount: rows.length,
    }
  }, [data?.volumeByDay])

  const dayOfWeekRows = useMemo(() => {
    const rows = data?.volumeByDay ?? []
    const totals = new Array(7).fill(0) as number[]
    const occurrences = new Array(7).fill(0) as number[]
    for (const r of rows) {
      const wd = weekdayIndexForBucket(r.date)
      totals[wd] += r.count
      occurrences[wd] += 1
    }
    return WEEKDAY_ORDER.map((wd) => ({
      label: WEEKDAY_SHORT[wd],
      total: totals[wd],
      avg: occurrences[wd] > 0 ? Math.round((totals[wd] / occurrences[wd]) * 10) / 10 : 0,
    }))
  }, [data?.volumeByDay])

  const busiestWeekday = useMemo(() => {
    if (dayOfWeekRows.every((r) => r.total === 0)) return null
    return dayOfWeekRows.reduce((b, r) => (r.total > b.total ? r : b), dayOfWeekRows[0])
  }, [dayOfWeekRows])

  const hourOfDayRows = useMemo(() => {
    const rows = data?.hourOfDay ?? []
    if (rows.length === 0) return []
    return rows.map((r) => ({
      hour: r.hour,
      label: formatHourLabel(r.hour),
      count: r.count,
    }))
  }, [data?.hourOfDay])

  const peakHour = useMemo(() => {
    if (hourOfDayRows.length === 0) return null
    if (hourOfDayRows.every((r) => r.count === 0)) return null
    return hourOfDayRows.reduce((b, r) => (r.count > b.count ? r : b), hourOfDayRows[0])
  }, [hourOfDayRows])

  const cumulativeRows = useMemo(() => {
    let running = 0
    return (data?.volumeByDay ?? []).map((r) => {
      running += r.count
      return { date: r.date, cumulative: running, count: r.count }
    })
  }, [data?.volumeByDay])

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
                    asChild
                  >
                    <Link href="/admin/search-daily-report">
                      <Sparkles className="h-4 w-4" />
                      <span className="ml-2">Search reports</span>
                    </Link>
                  </Button>
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

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
              label="Searches / day"
              value={dailySummary ? dailySummary.avgPerDay.toFixed(1) : "—"}
              change={volTrend.change}
              changeType={volTrend.changeType}
              subtitle={
                dailySummary
                  ? `Avg over ${dailySummary.dayCount}d · peak ${dailySummary.busiest.count.toLocaleString()}`
                  : "Average per day in range"
              }
              icon="📅"
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

          <HeadlineStrip headline={data.headline} />

          <InsightsPanel insights={data.insights} />

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

          {/* Searches per day — exact daily counts + summary */}
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Searches per day</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Marketplace /search only — exact count for each day in the range, day-over-day
                  change, and each day&apos;s share of total volume.
                </p>
              </div>
            </div>

            {dailySummary == null ? (
              <EmptyChart />
            ) : (
              <>
                <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Avg / day
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                      {dailySummary.avgPerDay.toFixed(1)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {dailySummary.avgPerActiveDay.toFixed(1)} per active day
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Busiest day
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                      {dailySummary.busiest.count.toLocaleString()}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {(() => {
                        try {
                          return format(parseISO(dailySummary.busiest.date), "EEE, MMM d")
                        } catch {
                          return dailySummary.busiest.date
                        }
                      })()}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Quietest active day
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                      {dailySummary.quietestActive
                        ? dailySummary.quietestActive.count.toLocaleString()
                        : "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {dailySummary.quietestActive
                        ? (() => {
                            try {
                              return format(
                                parseISO(dailySummary.quietestActive.date),
                                "EEE, MMM d",
                              )
                            } catch {
                              return dailySummary.quietestActive.date
                            }
                          })()
                        : "No active days"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Active days
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                      {dailySummary.activeDayCount}/{dailySummary.dayCount}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">Days with ≥1 search</p>
                  </div>
                </div>

                <div className="max-h-[420px] overflow-auto rounded-lg border border-slate-200">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-left">
                      <tr className="border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Day</th>
                        <th className="px-4 py-2.5 text-right">Searches</th>
                        <th className="px-4 py-2.5 text-right">% of total</th>
                        <th className="px-4 py-2.5 text-right">Δ vs prev</th>
                        <th className="hidden px-4 py-2.5 sm:table-cell">Volume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...dailyBreakdownRows].reverse().map((row) => {
                        const deltaType =
                          row.deltaPct == null
                            ? "neutral"
                            : row.deltaPct > 0.5
                              ? "positive"
                              : row.deltaPct < -0.5
                                ? "negative"
                                : "neutral"
                        const barPct =
                          dailySummary.busiest.count > 0
                            ? (row.count / dailySummary.busiest.count) * 100
                            : 0
                        return (
                          <tr
                            key={row.date}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                          >
                            <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-700 tabular-nums">
                              {(() => {
                                try {
                                  return format(parseISO(row.date), "MMM d, yyyy")
                                } catch {
                                  return row.date
                                }
                              })()}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                              {row.weekdayLong}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                              {row.count.toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                              {row.sharePct.toFixed(1)}%
                            </td>
                            <td
                              className={cn(
                                "px-4 py-2.5 text-right font-medium tabular-nums",
                                deltaType === "positive"
                                  ? "text-emerald-600"
                                  : deltaType === "negative"
                                    ? "text-rose-600"
                                    : "text-slate-400",
                              )}
                            >
                              {row.deltaPct == null
                                ? "—"
                                : `${row.deltaPct > 0 ? "+" : ""}${row.deltaPct.toFixed(0)}%`}
                            </td>
                            <td className="hidden px-4 py-2.5 sm:table-cell">
                              <div className="h-2 w-full max-w-[160px] overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-blue-500"
                                  style={{ width: `${Math.max(barPct, row.count > 0 ? 4 : 0)}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Time-of-week + time-of-day patterns */}
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Day-of-week pattern</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Average searches per weekday across the range — find the days demand peaks.
                  </p>
                </div>
                {busiestWeekday ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700">
                    <span className="h-2 w-2 rounded-full bg-indigo-600" />
                    Peak: {busiestWeekday.label}
                  </span>
                ) : null}
              </div>
              {dayOfWeekRows.every((r) => r.total === 0) ? (
                <EmptyChart />
              ) : (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dayOfWeekRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "#64748B", fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: "#E2E8F0" }}
                      />
                      <YAxis
                        tick={{ fill: "#64748B", fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={40}
                      />
                      <RechartsTooltip
                        cursor={{ fill: "rgba(99,102,241,0.08)" }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          const row = payload[0]?.payload as { total: number; avg: number }
                          return (
                            <AnalyticsTooltip
                              active
                              label={String(label ?? "")}
                              payload={[
                                { name: "Avg / day", value: row.avg, color: "#6366F1" },
                                { name: "Total", value: row.total, color: "#94A3B8" },
                              ]}
                            />
                          )
                        }}
                      />
                      <Bar dataKey="avg" radius={[4, 4, 0, 0]} maxBarSize={48} name="Avg / day">
                        {dayOfWeekRows.map((row) => (
                          <Cell
                            key={row.label}
                            fill={
                              busiestWeekday && row.label === busiestWeekday.label
                                ? "#6366F1"
                                : "#C7D2FE"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Peak search hours</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Searches folded into hour-of-day buckets (UTC) — the windows shoppers search most.
                  </p>
                </div>
                {peakHour ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700">
                    <span className="h-2 w-2 rounded-full bg-teal-600" />
                    Peak: {formatHourLabel(peakHour.hour)} UTC
                  </span>
                ) : null}
              </div>
              {hourOfDayRows.length === 0 || hourOfDayRows.every((r) => r.count === 0) ? (
                <EmptyChart />
              ) : (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourOfDayRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="hourGradientDash" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0D9488" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#5EEAD4" stopOpacity={0.7} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis
                        dataKey="label"
                        interval={1}
                        tick={{ fill: "#64748B", fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: "#E2E8F0" }}
                      />
                      <YAxis
                        tick={{ fill: "#64748B", fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={40}
                      />
                      <RechartsTooltip
                        cursor={{ fill: "rgba(13,148,136,0.08)" }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const row = payload[0]?.payload as { hour: number; count: number }
                          return (
                            <AnalyticsTooltip
                              active
                              label={`${formatHourLabel(row.hour)} – ${formatHourLabel((row.hour + 1) % 24)} UTC`}
                              payload={[{ name: "Searches", value: row.count, color: "#0D9488" }]}
                            />
                          )
                        }}
                      />
                      <Bar
                        dataKey="count"
                        fill="url(#hourGradientDash)"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={22}
                        name="Searches"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Cumulative search volume */}
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Cumulative searches</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Running total across the range — a steepening curve means accelerating demand.
                </p>
              </div>
            </div>
            {cumulativeRows.length === 0 ? (
              <EmptyChart />
            ) : (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cumulativeRows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cumulativeGradientDash" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
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
                      axisLine={false}
                      width={48}
                    />
                    <RechartsTooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const row = payload[0]?.payload as { cumulative: number; count: number }
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
                            label={labelStr || undefined}
                            payload={[
                              { name: "Cumulative", value: row.cumulative, color: "#8B5CF6" },
                              { name: "That day", value: row.count, color: "#C4B5FD" },
                            ]}
                          />
                        )
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      stroke="#8B5CF6"
                      strokeWidth={2.5}
                      fill="url(#cumulativeGradientDash)"
                      name="Cumulative"
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
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-sm">
                  <TrendingUp className="h-5 w-5" />
                </span>
                <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  All‑time &amp; monthly trending detail
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Marketplace queries only · momentum = recent volume vs the prior window.&nbsp;
                  <span className="text-slate-600">
                    {periodTrendMode === "all"
                      ? "All-time compares the later half of stored history versus the earlier half."
                      : periodTrendMode === "window"
                        ? `Comparing the last ${periodTrendWindowDays} days against the ${periodTrendWindowDays} days before that.`
                        : "Compares the chosen calendar month to the immediately prior month (UTC)."}
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
              </div>
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end">
                <div className="flex flex-col gap-1.5 sm:min-w-[200px]">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Period
                  </span>
                  <Select value={periodTrendSelectValue} onValueChange={onPeriodTrendChange}>
                    <SelectTrigger className="h-9 border-slate-200 bg-white sm:w-[240px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Rolling comparison</SelectLabel>
                        {PERIOD_TREND_CHOICES.filter((c) => c.group === "Rolling comparison").map(
                          (c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ),
                        )}
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>Fixed period</SelectLabel>
                        {PERIOD_TREND_CHOICES.filter((c) => c.group === "Fixed period").map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
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
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <TrendStatTile
                    label="Rising queries"
                    value={periodTrendStats.count.toLocaleString()}
                    hint="Met the momentum threshold"
                    tone="violet"
                  />
                  <TrendStatTile
                    label="New entrants"
                    value={periodTrendStats.newEntrants.toLocaleString()}
                    hint="No volume in the prior window"
                    tone="emerald"
                  />
                  <TrendStatTile
                    label="Recent volume"
                    value={periodTrendStats.recentVolume.toLocaleString()}
                    hint="Searches across rising queries"
                    tone="blue"
                  />
                  <TrendStatTile
                    label="Top mover"
                    value={periodTrendStats.topMover ? `${periodTrendStats.topMover.velocity.toFixed(1)}×` : "—"}
                    hint={periodTrendStats.topMover ? truncateQuery(periodTrendStats.topMover.query, 22) : "No data"}
                    tone="amber"
                  />
                </div>

                <div className="max-h-[460px] overflow-x-auto overflow-y-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2.5 font-semibold">#</th>
                        <th className="px-3 py-2.5 font-semibold">Query</th>
                        <th className="px-3 py-2.5 font-semibold">Recent volume</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Prior</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Change</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Velocity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodTrendRowsSorted.map((row, i) => {
                        const delta = row.recentCount - row.previousCount
                        const isNew = row.previousCount === 0
                        const barPct =
                          periodTrendStats.maxRecent > 0
                            ? Math.max(4, (row.recentCount / periodTrendStats.maxRecent) * 100)
                            : 0
                        return (
                          <tr
                            key={row.query}
                            className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70"
                          >
                            <td className="px-3 py-2.5 tabular-nums text-slate-400">{i + 1}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className="max-w-[220px] truncate font-medium text-slate-800"
                                  title={row.query}
                                >
                                  {row.query}
                                </span>
                                {isNew ? (
                                  <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                                    New
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                                    style={{ width: `${barPct}%` }}
                                  />
                                </div>
                                <span className="w-8 tabular-nums text-slate-700">
                                  {row.recentCount}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">
                              {row.previousCount}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-0.5 tabular-nums font-medium",
                                  delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-slate-400",
                                )}
                              >
                                {delta > 0 ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : delta < 0 ? (
                                  <TrendingDown className="h-3 w-3" />
                                ) : null}
                                {delta > 0 ? `+${delta}` : delta}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <span
                                className={cn(
                                  "inline-block rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                                  row.velocity >= 5
                                    ? "bg-fuchsia-100 text-fuchsia-700"
                                    : row.velocity >= 2
                                      ? "bg-violet-100 text-violet-700"
                                      : "bg-slate-100 text-slate-600",
                                )}
                              >
                                {row.velocity.toFixed(2)}×
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
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

          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Captured demand — “notify me when listed”
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Shoppers who hit a dead end and left an email so Reswell can source the board or
                  alert them. Each one is a confirmed sale waiting on supply.
                </p>
              </div>
              {data.demandCapture.total > 0 ? (
                <div className="flex gap-4">
                  <div className="text-right">
                    <div className="text-2xl font-bold tabular-nums text-slate-900">
                      {data.demandCapture.total.toLocaleString()}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">Requests</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold tabular-nums text-blue-600">
                      {data.demandCapture.uniquePeople.toLocaleString()}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">People</div>
                  </div>
                </div>
              ) : null}
            </div>
            {data.demandCapture.byQuery.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">
                No demand captured in this range — when a dead-end search converts a “notify me”
                signup, it shows here.
              </p>
            ) : (
              <div className="max-h-[340px] overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
                    <tr className="text-left text-slate-500">
                      <th className="p-2 font-medium">Query</th>
                      <th className="p-2 text-right font-medium">Requests</th>
                      <th className="p-2 text-right font-medium">People</th>
                      <th className="p-2 text-right font-medium">Last asked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.demandCapture.byQuery.map((row) => {
                      let last = row.lastAt
                      try {
                        last = format(parseISO(row.lastAt), "MMM d")
                      } catch {
                        /* keep raw */
                      }
                      return (
                        <tr key={row.query} className="border-b border-slate-100 last:border-0">
                          <td className="max-w-[280px] truncate p-2" title={row.query}>
                            {row.query}
                          </td>
                          <td className="p-2 text-right tabular-nums">{row.count}</td>
                          <td className="p-2 text-right tabular-nums text-blue-600">{row.people}</td>
                          <td className="p-2 text-right tabular-nums text-slate-500">{last}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Header nav search — event log</h3>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Every search action from the main nav search bar in the selected window — free-form{" "}
                <code className="rounded bg-slate-100 px-1 text-[11px]">/search</code> submits and
                typeahead row clicks. Newest first (up to{" "}
                {data.navSearchBar.recentEvents.length.toLocaleString()} shown).
              </p>
            </div>
            {data.navSearchBar.recentEvents.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                No nav search events in this range yet.
              </p>
            ) : (
              <div
                className="max-h-[min(420px,50vh)] overflow-y-auto rounded-lg border border-slate-200"
                role="list"
                aria-label="Header nav search events"
              >
                <ul className="divide-y divide-slate-100">
                  {data.navSearchBar.recentEvents.map((row) => {
                    let when = row.occurredAt
                    try {
                      when = format(parseISO(row.occurredAt), "MMM d, h:mm a")
                    } catch {
                      /* keep raw */
                    }
                    const isFreeForm = row.kind === "free_form"
                    return (
                      <li
                        key={row.id}
                        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2.5 text-sm sm:flex-nowrap"
                      >
                        <time
                          className="shrink-0 text-xs tabular-nums text-slate-500 sm:w-[9.5rem]"
                          dateTime={row.occurredAt}
                          title={row.occurredAt}
                        >
                          {when}
                        </time>
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium",
                            isFreeForm
                              ? "bg-blue-50 text-blue-800 ring-1 ring-blue-200/80"
                              : "bg-violet-50 text-violet-800 ring-1 ring-violet-200/80",
                          )}
                        >
                          {isFreeForm ? "Free-form" : "Dropdown"}
                        </span>
                        <span
                          className="min-w-0 flex-1 truncate font-medium text-slate-900"
                          title={row.query}
                        >
                          {row.query}
                        </span>
                        <span className="w-full shrink-0 text-xs text-slate-500 sm:ml-auto sm:w-auto sm:max-w-[45%] sm:text-right">
                          {isFreeForm ? (
                            <>
                              {row.resultCount != null
                                ? `${row.resultCount.toLocaleString()} listing${
                                    row.resultCount === 1 ? "" : "s"
                                  }`
                                : "—"}
                            </>
                          ) : (
                            <>
                              {row.detail && row.detail !== "—" ? (
                                <span className="truncate" title={row.detail}>
                                  {truncateQuery(row.detail, 48)}
                                </span>
                              ) : null}
                              {row.pickKind ? (
                                <span className="text-slate-400">
                                  {row.detail && row.detail !== "—" ? " · " : ""}
                                  {navPickKindLabel(row.pickKind)}
                                </span>
                              ) : null}
                            </>
                          )}
                        </span>
                      </li>
                    )
                  })}
                </ul>
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
