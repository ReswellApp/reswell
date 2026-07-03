"use client"

import type { ReactNode } from "react"
import { useCallback, useMemo, useState, useTransition } from "react"
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
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Download,
  ExternalLink,
  Globe,
  Layers,
  Loader2,
  MonitorSmartphone,
  MousePointerClick,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type {
  GoogleAnalyticsDashboardResult,
  GoogleAnalyticsComparisonMetric,
  GoogleAnalyticsEmbedStat,
} from "@/lib/services/googleAnalytics"

const RANGE_OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 28, label: "Last 28 days" },
  { value: 90, label: "Last 90 days" },
] as const

const CHART_COLORS = ["#2563eb", "#0ea5e9", "#14b8a6", "#8b5cf6", "#f59e0b", "#ef4444", "#64748b"]

const CHART_TOOLTIP_STYLE = {
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
} as const

type Accent = "primary" | "sky" | "teal" | "amber" | "violet" | "rose" | "emerald"
type PillTone = "slate" | "blue" | "teal" | "amber" | "emerald" | "rose" | "violet"

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("en-US")
}

function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—"
  return `${(value * 100).toFixed(digits)}%`
}

function formatDelta(metric: GoogleAnalyticsComparisonMetric): string | null {
  if (metric.changePercent == null) return metric.current > 0 ? "new" : null
  if (metric.changePercent === 0) return null
  const sign = metric.changePercent > 0 ? "+" : ""
  return `${sign}${metric.changePercent.toFixed(0)}%`
}

function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

function formatLinkType(value: string): string {
  return value.replace(/_/g, " ")
}

function formatReferrer(value: string): string {
  if (value === "(direct)" || value === "(not set)") return value
  try {
    const url = new URL(value)
    return url.hostname.replace(/^www\./, "")
  } catch {
    return value.length > 48 ? `${value.slice(0, 45)}…` : value
  }
}

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const lines = [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))]
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function KpiCard({
  label,
  value,
  subtitle,
  icon,
  accent,
  delta,
}: {
  label: string
  value: string
  subtitle?: string
  icon: ReactNode
  accent: Accent
  delta?: GoogleAnalyticsComparisonMetric
}) {
  const accentBar: Record<Accent, string> = {
    primary: "bg-blue-600",
    sky: "bg-sky-500",
    teal: "bg-teal-500",
    amber: "bg-amber-500",
    violet: "bg-violet-500",
    rose: "bg-rose-500",
    emerald: "bg-emerald-500",
  }
  const iconTint: Record<Accent, string> = {
    primary: "bg-blue-50 text-blue-600",
    sky: "bg-sky-50 text-sky-600",
    teal: "bg-teal-50 text-teal-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    rose: "bg-rose-50 text-rose-600",
    emerald: "bg-emerald-50 text-emerald-600",
  }
  const deltaLabel = delta ? formatDelta(delta) : null
  const deltaUp = (delta?.changePercent ?? 0) > 0
  const deltaDown = (delta?.changePercent ?? 0) < 0

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <span className={cn("absolute inset-y-0 left-0 w-1", accentBar[accent])} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
          {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
          {deltaLabel ? (
            <p
              className={cn(
                "mt-2 inline-flex items-center gap-1 text-xs font-semibold tabular-nums",
                deltaUp && "text-emerald-700",
                deltaDown && "text-rose-700",
                !deltaUp && !deltaDown && "text-slate-500",
              )}
            >
              {deltaUp ? <TrendingUp className="h-3.5 w-3.5" /> : null}
              {deltaDown ? <TrendingDown className="h-3.5 w-3.5" /> : null}
              {deltaLabel} vs prior period
            </p>
          ) : null}
        </div>
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", iconTint[accent])}>
          {icon}
        </span>
      </div>
    </div>
  )
}

function SectionCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6", className)}>
      {children}
    </div>
  )
}

function SectionHeader({
  title,
  description,
  icon,
  trailing,
}: {
  title: string
  description?: string
  icon?: ReactNode
  trailing?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon ? <span className="text-slate-400">{icon}</span> : null}
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
        {description ? <p className="mt-1 max-w-2xl text-xs text-slate-500">{description}</p> : null}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </div>
  )
}

function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: PillTone }) {
  const tones: Record<PillTone, string> = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    teal: "bg-teal-50 text-teal-700 border-teal-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold",
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[140px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-sm text-slate-500">
      {children}
    </div>
  )
}

function ProgressMeter({ label, value, total, tone = "blue" }: { label: string; value: number; total: number; tone?: "blue" | "violet" | "amber" }) {
  const pct = total > 0 ? value / total : 0
  const bar = tone === "violet" ? "bg-violet-500" : tone === "amber" ? "bg-amber-500" : "bg-blue-500"
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-medium text-slate-700">{label}</span>
        <span className="shrink-0 text-xs tabular-nums text-slate-500">
          {formatNumber(value)} · {formatPercent(pct, 0)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${Math.max(pct * 100, value > 0 ? 4 : 0)}%` }} />
      </div>
    </div>
  )
}

function SetupPanel({ reason }: { reason: string }) {
  const isPermissionError = /permission denied|403|sufficient permissions/i.test(reason)
  return (
    <SectionCard>
      <SectionHeader
        title={isPermissionError ? "Google Analytics access needed" : "Connect Google Analytics 4"}
        description="This page reads GA4 via the Data API (server-side). That is separate from the browser tag on embed pages."
        icon={<BarChart3 className="h-4 w-4" />}
      />
      <div className="space-y-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4">
        <p className="text-sm text-slate-600">{reason}</p>
        <a
          href="https://analytics.google.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
        >
          Open Google Analytics
          <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>
    </SectionCard>
  )
}

function EmbedTable({
  rows,
  search,
}: {
  rows: GoogleAnalyticsEmbedStat[]
  search: string
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.slug.includes(q) || r.path.toLowerCase().includes(q))
  }, [rows, search])

  if (filtered.length === 0) {
    return <EmptyState>No embeds match your search.</EmptyState>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="pb-2 pr-4 font-medium">Embed</th>
            <th className="pb-2 pr-4 font-medium text-right">Sessions</th>
            <th className="pb-2 pr-4 font-medium text-right">Views</th>
            <th className="pb-2 pr-4 font-medium text-right">Clicks</th>
            <th className="pb-2 font-medium text-right">CTR</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.slug} className="border-b border-slate-100 last:border-0">
              <td className="py-2.5 pr-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">{row.slug}</span>
                  <a
                    href={row.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-blue-600"
                    aria-label={`Open ${row.slug} embed`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
                <div className="text-xs text-slate-500">{row.path}</div>
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums text-slate-700">{formatNumber(row.sessions)}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums text-slate-700">{formatNumber(row.views)}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums text-slate-700">{formatNumber(row.clicks)}</td>
              <td className="py-2.5 text-right tabular-nums text-slate-700">
                {row.sessions > 0 ? formatPercent(row.clickThroughRate) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function GoogleAnalyticsAdminClient({
  initialData,
}: {
  initialData: GoogleAnalyticsDashboardResult
}) {
  const [data, setData] = useState(initialData)
  const [rangeDays, setRangeDays] = useState(initialData.configured ? initialData.rangeDays : 28)
  const [error, setError] = useState<string | null>(null)
  const [embedSearch, setEmbedSearch] = useState("")
  const [isPending, startTransition] = useTransition()

  const refresh = useCallback(
    (days: number) => {
      startTransition(async () => {
        setError(null)
        try {
          const res = await fetch(`/api/admin/google-analytics?days=${days}`, { credentials: "include", cache: "no-store" })
          const json = (await res.json()) as { data?: GoogleAnalyticsDashboardResult; error?: string }
          if (!res.ok) {
            setError(json.error ?? "Could not refresh analytics")
            return
          }
          if (json.data) setData(json.data)
        } catch {
          setError("Could not refresh analytics")
        }
      })
    },
    [startTransition],
  )

  const onRangeChange = (value: string) => {
    const days = Number.parseInt(value, 10)
    if (!Number.isFinite(days)) return
    setRangeDays(days)
    refresh(days)
  }

  const exportEmbedsCsv = useCallback(() => {
    if (!data.configured) return
    downloadCsv(
      `reswell-embed-analytics-${rangeDays}d.csv`,
      ["slug", "path", "sessions", "views", "clicks", "ctr"],
      data.partnerEmbeds.byEmbed.map((r) => [
        r.slug,
        r.path,
        r.sessions,
        r.views,
        r.clicks,
        r.sessions > 0 ? (r.clickThroughRate * 100).toFixed(2) : "0",
      ]),
    )
  }, [data, rangeDays])

  if (!data.configured) {
    return <SetupPanel reason={data.reason} />
  }

  const channelData = data.site.channels.map((c, i) => ({
    name: c.channel,
    value: c.sessions,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }))

  const embedChartData = data.partnerEmbeds.daily.map((row) => {
    const clickRow = data.partnerEmbeds.clickDaily.find((c) => c.date === row.date)
    return { date: row.date, sessions: row.sessions, views: row.views, clicks: clickRow?.clicks ?? 0 }
  })

  const deviceTotal = data.devices.reduce((sum, d) => sum + d.sessions, 0)
  const topChannelShare = data.site.channels[0]
    ? data.site.channels[0].sessions / Math.max(data.site.totals.sessions, 1)
    : 0

  return (
    <div className="space-y-6">
      {/* Command bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-violet-50/40 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="violet">
            <Activity className="h-3 w-3" />
            Property {data.propertyId}
          </Pill>
          <Pill tone={data.realtime.activeUsers > 0 ? "emerald" : "slate"}>
            <Zap className="h-3 w-3" />
            {formatNumber(data.realtime.activeUsers)} active now
          </Pill>
          <Pill tone={data.clientMeasurementConfigured ? "emerald" : "amber"}>
            Client tag {data.clientMeasurementConfigured ? "live" : "missing"}
          </Pill>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(rangeDays)} onValueChange={onRangeChange}>
            <SelectTrigger className="h-9 w-[160px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 bg-white" onClick={exportEmbedsCsv}>
            <Download className="h-4 w-4" />
            Export embeds
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-9 bg-white" onClick={() => refresh(rangeDays)} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {!data.clientMeasurementConfigured ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Set <code className="text-xs">NEXT_PUBLIC_GA4_MEASUREMENT_ID</code> and redeploy so partner embed iframes send page views and click events.
        </div>
      ) : null}

      {data.insights.length > 0 ? (
        <SectionCard className="border-violet-200/80 bg-gradient-to-r from-violet-50/50 to-white">
          <SectionHeader
            title="Insights"
            description="Automated highlights from the selected window vs the prior period."
            icon={<Sparkles className="h-4 w-4 text-violet-500" />}
          />
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.insights.map((insight) => (
              <li key={insight} className="flex items-start gap-2 rounded-lg border border-violet-100 bg-white/80 px-3 py-2.5 text-sm text-slate-700">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard label="Sessions" value={formatNumber(data.site.totals.sessions)} icon={<Activity className="h-4 w-4" />} accent="primary" delta={data.comparison.sessions} />
        <KpiCard label="Users" value={formatNumber(data.site.totals.totalUsers)} icon={<Users className="h-4 w-4" />} accent="sky" delta={data.comparison.users} />
        <KpiCard label="Page views" value={formatNumber(data.site.totals.screenPageViews)} icon={<BarChart3 className="h-4 w-4" />} accent="teal" delta={data.comparison.pageViews} />
        <KpiCard label="Conversions" value={formatNumber(data.site.totals.conversions)} icon={<TrendingUp className="h-4 w-4" />} accent="emerald" delta={data.comparison.conversions} />
        <KpiCard label="Embed sessions" value={formatNumber(data.partnerEmbeds.totals.sessions)} subtitle="/embed/listings/*" icon={<Layers className="h-4 w-4" />} accent="violet" delta={data.comparison.embedSessions} />
        <KpiCard label="Embed clicks" value={formatNumber(data.partnerEmbeds.totals.clicks)} subtitle={`CTR ${formatPercent(data.partnerEmbeds.totals.clickThroughRate)}`} icon={<MousePointerClick className="h-4 w-4" />} accent="amber" delta={data.comparison.embedClicks} />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-slate-100/80 p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="embeds">Partner embeds</TabsTrigger>
          <TabsTrigger value="acquisition">Acquisition</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SectionCard className="lg:col-span-2">
              <SectionHeader
                title="Site traffic"
                description={`Sessions and page views · ${rangeDays}d · ${formatPercent(data.site.totals.engagementRate)} engaged`}
                icon={<BarChart3 className="h-4 w-4" />}
              />
              {data.site.daily.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={data.site.daily} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gaSessions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gaViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={formatDateLabel} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} minTickGap={24} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                    <RechartsTooltip contentStyle={CHART_TOOLTIP_STYLE} labelFormatter={(l) => formatDateLabel(String(l))} />
                    <Area type="monotone" dataKey="sessions" name="Sessions" stroke="#2563eb" fill="url(#gaSessions)" strokeWidth={2} />
                    <Area type="monotone" dataKey="views" name="Views" stroke="#14b8a6" fill="url(#gaViews)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>No sessions in this window.</EmptyState>
              )}
            </SectionCard>

            <SectionCard>
              <SectionHeader title="Channel mix" description={`Top channel: ${topChannelShare > 0 ? formatPercent(topChannelShare, 0) : "—"} of sessions`} icon={<TrendingUp className="h-4 w-4" />} />
              {channelData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={channelData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={2}>
                      {channelData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>No channel data.</EmptyState>
              )}
              <ul className="mt-2 space-y-1">
                {data.site.channels.slice(0, 5).map((c, i) => (
                  <li key={c.channel} className="flex items-center justify-between text-xs text-slate-600">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      {c.channel}
                    </span>
                    <span className="tabular-nums font-medium text-slate-800">{formatNumber(c.sessions)}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SectionCard>
              <SectionHeader title="Engagement" icon={<Activity className="h-4 w-4" />} />
              <div className="space-y-3">
                <ProgressMeter label="Engaged sessions" value={data.site.totals.engagedSessions} total={data.site.totals.sessions} />
                <p className="text-xs text-slate-500">Engagement rate {formatPercent(data.site.totals.engagementRate)} across all pages.</p>
              </div>
            </SectionCard>
            <SectionCard>
              <SectionHeader title="Listing pages" description={`${data.productPathPrefix} traffic`} icon={<Layers className="h-4 w-4" />} />
              <p className="text-2xl font-bold tabular-nums text-slate-900">{formatNumber(data.productPages.totals.sessions)}</p>
              <p className="mt-1 text-xs text-slate-500">{formatNumber(data.productPages.totals.screenPageViews)} views · {formatNumber(data.productPages.totals.conversions)} conversions</p>
            </SectionCard>
            <SectionCard>
              <SectionHeader title="Embed funnel" icon={<MousePointerClick className="h-4 w-4" />} />
              <div className="space-y-3">
                <ProgressMeter label="Sessions → clicks" value={data.partnerEmbeds.totals.clicks} total={Math.max(data.partnerEmbeds.totals.sessions, 1)} tone="violet" />
                <p className="text-xs text-slate-500">Overall embed CTR {formatPercent(data.partnerEmbeds.totals.clickThroughRate)}.</p>
              </div>
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="embeds" className="space-y-4">
          <SectionCard>
            <SectionHeader
              title="Partner embed performance"
              description={`Iframe loads and outbound clicks · ${rangeDays} days`}
              icon={<MousePointerClick className="h-4 w-4" />}
              trailing={
                <a href="/admin/partner-embeds" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                  Manage embeds
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              }
            />
            {embedChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={embedChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatDateLabel} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                  <RechartsTooltip contentStyle={CHART_TOOLTIP_STYLE} labelFormatter={(l) => formatDateLabel(String(l))} />
                  <Bar dataKey="sessions" name="Sessions" fill="#c4b5fd" radius={[4, 4, 0, 0]} barSize={14} />
                  <Line type="monotone" dataKey="clicks" name="Clicks" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState>No partner embed traffic in this window.</EmptyState>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Input value={embedSearch} onChange={(e) => setEmbedSearch(e.target.value)} placeholder="Search embed slug…" className="max-w-xs" />
              {data.partnerEmbeds.clicksByLinkType.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {data.partnerEmbeds.clicksByLinkType.map((row) => (
                    <Pill key={row.linkType} tone="amber">
                      {formatLinkType(row.linkType)} · {formatNumber(row.count)}
                    </Pill>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-4">
              <EmbedTable rows={data.partnerEmbeds.byEmbed} search={embedSearch} />
            </div>
          </SectionCard>

          {data.partnerEmbeds.referrers.length > 0 ? (
            <SectionCard>
              <SectionHeader title="Embed referrers" description="Partner sites sending traffic into embed iframes." icon={<Globe className="h-4 w-4" />} />
              <ul className="space-y-2">
                {data.partnerEmbeds.referrers.map((row) => (
                  <li key={row.referrer} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm">
                    <span className="truncate text-slate-700" title={row.referrer}>{formatReferrer(row.referrer)}</span>
                    <span className="shrink-0 tabular-nums font-semibold text-slate-900">{formatNumber(row.sessions)}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}
        </TabsContent>

        <TabsContent value="acquisition" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard>
              <SectionHeader title="Channels" description="Session default channel group." icon={<TrendingUp className="h-4 w-4" />} />
              {channelData.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(channelData.length * 36, 160)}>
                  <BarChart data={channelData} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                    <RechartsTooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Bar dataKey="value" name="Sessions" radius={[0, 4, 4, 0]}>
                      {channelData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>No channel data.</EmptyState>
              )}
            </SectionCard>

            <SectionCard>
              <SectionHeader title="Devices" description="Sessions by device category." icon={<MonitorSmartphone className="h-4 w-4" />} />
              <div className="space-y-3">
                {data.devices.map((d) => (
                  <ProgressMeter key={d.label} label={d.label} value={d.sessions} total={deviceTotal} />
                ))}
                {data.devices.length === 0 ? <EmptyState>No device breakdown.</EmptyState> : null}
              </div>
            </SectionCard>
          </div>

          <SectionCard>
            <SectionHeader title="Countries" description="Top session countries." icon={<Globe className="h-4 w-4" />} />
            {data.countries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="pb-2 pr-4 font-medium">Country</th>
                      <th className="pb-2 pr-4 font-medium text-right">Sessions</th>
                      <th className="pb-2 font-medium text-right">Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.countries.map((row) => (
                      <tr key={row.label} className="border-b border-slate-100 last:border-0">
                        <td className="py-2.5 pr-4 font-medium text-slate-900">{row.label}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums text-slate-700">{formatNumber(row.sessions)}</td>
                        <td className="py-2.5 text-right tabular-nums text-slate-700">{formatNumber(row.views)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState>No country data.</EmptyState>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SectionCard>
              <SectionHeader title="Top pages" description="Site-wide by views." icon={<BarChart3 className="h-4 w-4" />} />
              {data.site.topPages.length > 0 ? (
                <PageTable rows={data.site.topPages.map((p) => ({ path: p.path, title: p.title, views: p.views, sessions: p.sessions }))} />
              ) : (
                <EmptyState>No page data.</EmptyState>
              )}
            </SectionCard>
            <SectionCard>
              <SectionHeader title="Listing pages" description={`Paths under ${data.productPathPrefix}`} icon={<Layers className="h-4 w-4" />} />
              {data.productPages.topPages.length > 0 ? (
                <PageTable rows={data.productPages.topPages.map((p) => ({ path: p.path, title: p.title, views: p.views, sessions: p.sessions }))} />
              ) : (
                <EmptyState>No listing page traffic.</EmptyState>
              )}
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <SectionCard>
            <SectionHeader title="Top events" description="Most fired GA4 events in the window." icon={<Zap className="h-4 w-4" />} />
            {data.topEvents.length > 0 ? (
              <div className="space-y-2">
                {data.topEvents.map((row, i) => {
                  const max = data.topEvents[0]?.count ?? 1
                  return (
                    <div key={row.eventName} className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
                      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium text-slate-800">{row.eventName}</span>
                        <span className="tabular-nums font-semibold text-slate-900">{formatNumber(row.count)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.max((row.count / max) * 100, 4)}%` }} />
                      </div>
                      {i === 0 && row.eventName === "partner_embed_click" ? (
                        <p className="mt-1 text-[11px] text-emerald-700">Partner embed click tracking is firing.</p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState>No event data.</EmptyState>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      <p className="text-center text-[11px] text-slate-400">
        Data cached ~1h · Generated {new Date(data.generatedAt).toLocaleString("en-US")}
      </p>
    </div>
  )
}

function PageTable({
  rows,
}: {
  rows: { path: string; title: string | null; views: number; sessions: number }[]
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="pb-2 pr-4 font-medium">Page</th>
            <th className="pb-2 pr-4 font-medium text-right">Views</th>
            <th className="pb-2 font-medium text-right">Sessions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.path} className="border-b border-slate-100 last:border-0">
              <td className="py-2.5 pr-4">
                <div className="font-medium text-slate-900">{row.path}</div>
                {row.title ? <div className="text-xs text-slate-500">{row.title}</div> : null}
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums text-slate-700">{formatNumber(row.views)}</td>
              <td className="py-2.5 text-right tabular-nums text-slate-700">{formatNumber(row.sessions)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
