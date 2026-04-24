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
  Scatter,
  ScatterChart,
  Tooltip as RechartsTooltip,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts"
import { Loader2, RefreshCw, Sparkles } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import type { SearchAnalyticsDashboard } from "@/lib/services/searchAnalytics"
import { cn } from "@/lib/utils"

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const

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
        "flex flex-col items-stretch gap-5 rounded-xl border border-border/60 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-center sm:gap-10",
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
      <ul className="flex min-w-0 flex-1 flex-col gap-3 text-sm sm:max-w-[240px]">
        {data.map((row) => {
          const pct = total > 0 ? Math.round((row.value / total) * 100) : 0
          return (
            <li key={row.name} className="flex gap-2.5">
              <span
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-[2px] border border-white/80 shadow-sm"
                style={{ backgroundColor: row.fill }}
              />
              <span className="min-w-0">
                <span className="block font-medium leading-snug text-foreground">{row.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {row.value.toLocaleString()} searches · {pct}%
                </span>
              </span>
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

export function SearchAnalyticsAdminClient() {
  const [days, setDays] = useState<string>("14")
  const [data, setData] = useState<SearchAnalyticsDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initialAttemptDoneRef = useRef(false)

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

  const treemapFlat = useMemo(
    () =>
      (data?.topQueries ?? []).slice(0, 20).map((q) => ({
        name: truncateQuery(q.query, 22),
        size: q.count,
        full: q.query,
      })),
    [data?.topQueries],
  )

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

  const zeroSharePct =
    data?.zeroResultSearchShare != null
      ? Math.round(data.zeroResultSearchShare * 1000) / 10
      : null

  const sparkSlice = useMemo(
    () => (data?.volumeByDay ?? []).slice(-8),
    [data?.volumeByDay],
  )

  return (
    <div className="space-y-8">
      <div className="rounded-xl border bg-gradient-to-br from-muted/40 via-background to-background p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
              <Sparkles className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Elasticsearch event stream</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                Each point reflects a real <code className="rounded bg-muted px-1">/search?q=</code>{" "}
                request. Charts combine time series, distribution, and concentration metrics from the{" "}
                <code className="rounded bg-muted px-1">reswell_search_analytics</code> index.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Range</span>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[168px] h-9">
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
              className="h-9"
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

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {loading && !data ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-16 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading search analytics…
        </div>
      ) : data && !data.configured ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Elasticsearch not configured</CardTitle>
            <CardDescription>
              Set cluster URL and credentials; this dashboard reads the same client as listing search.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InsightStat
              title="Total searches"
              value={data.totalSearches.toLocaleString()}
              hint={`${data.rangeDays}-day window`}
              spark={sparkSlice}
            />
            <InsightStat
              title="Unique queries"
              value={data.uniqueQueriesApprox.toLocaleString()}
              hint="ES cardinality (approx.)"
              badge={
                data.totalSearches > 0
                  ? `${Math.round((data.uniqueQueriesApprox / data.totalSearches) * 100)}% of volume`
                  : undefined
              }
              spark={sparkSlice}
            />
            <InsightStat
              title="Avg. results"
              value={
                data.avgResultCount != null && Number.isFinite(data.avgResultCount)
                  ? data.avgResultCount.toFixed(1)
                  : "—"
              }
              hint={
                data.resultCountStats.max != null
                  ? `max ${data.resultCountStats.max} · σ ${data.resultCountStats.stdDeviation != null ? data.resultCountStats.stdDeviation.toFixed(1) : "—"}`
                  : "Mean listings returned"
              }
              spark={sparkSlice}
            />
            <InsightStat
              title="Zero-result share"
              value={zeroSharePct != null ? `${zeroSharePct}%` : "—"}
              hint="Logged empty grids"
              badge={
                data.queryConcentration != null
                  ? `HHI ${data.queryConcentration.toFixed(2)}`
                  : undefined
              }
              spark={sparkSlice}
            />
          </div>

          <Card className="overflow-hidden border-primary/15 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Volume and 3-day moving average</CardTitle>
                  <CardDescription>
                    Daily search events with a smoothed trend line to damp single-day spikes.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="font-normal">
                  Composed chart
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {volumeWithMa.length === 0 ? (
                <EmptyChart />
              ) : (
                <ChartContainer
                  config={{
                    count: {
                      label: "Searches",
                      theme: {
                        light: "hsl(240 5.9% 10%)",
                        dark: "hsl(0 0% 92%)",
                      },
                    },
                    ma: {
                      label: "3d MA",
                      theme: {
                        light: "hsl(262 83% 48%)",
                        dark: "hsl(262 83% 65%)",
                      },
                    },
                  }}
                  className="h-[300px] w-full"
                >
                  <ComposedChart data={volumeWithMa} margin={{ left: 8, right: 8, top: 12 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(v) => {
                        try {
                          return format(parseISO(String(v)), "MMM d")
                        } catch {
                          return String(v)
                        }
                      }}
                    />
                    <YAxis yAxisId="left" tickLine={false} axisLine={false} width={40} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(_v, payload) => {
                            const d = payload?.[0]?.payload?.date
                            if (typeof d !== "string") return ""
                            try {
                              return format(parseISO(d), "MMM d, yyyy")
                            } catch {
                              return d
                            }
                          }}
                        />
                      }
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="count"
                      radius={[4, 4, 0, 0]}
                      fill="var(--color-count)"
                      fillOpacity={0.85}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="ma"
                      stroke="var(--color-ma)"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  </ComposedChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Query demand treemap</CardTitle>
                <CardDescription>
                  Tile area encodes search frequency; hover to read the full string.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[320px]">
                {treemapFlat.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ChartContainer
                    config={{
                      tm: { label: "Searches", color: ACCENT.primary },
                    }}
                    className="h-full w-full"
                  >
                    <Treemap
                      data={treemapFlat}
                      dataKey="size"
                      aspectRatio={4 / 3}
                      stroke="hsl(var(--border))"
                      isAnimationActive={false}
                      content={<TreemapCell />}
                    >
                      <RechartsTooltip
                        content={({ payload }) => {
                          const p = payload?.[0]?.payload as
                            | { full?: string; name?: string; size?: number }
                            | undefined
                          if (!p) return null
                          return (
                            <div className="rounded-md border bg-background px-2 py-1.5 text-xs shadow-md">
                              <p className="font-medium text-foreground max-w-[240px] break-words">
                                {p.full ?? p.name}
                              </p>
                              <p className="text-muted-foreground tabular-nums">
                                {p.size?.toLocaleString()} searches
                              </p>
                            </div>
                          )
                        }}
                      />
                    </Treemap>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Health radar</CardTitle>
                <CardDescription>
                  Normalized scores from live totals for at-a-glance balance.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[320px]">
                {radarRows.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ChartContainer
                    config={{
                      radar: {
                        label: "Composite",
                        color: ACCENT.violet,
                      },
                    }}
                    className="h-full w-full mx-auto max-w-[340px]"
                  >
                    <RadarChart cx="50%" cy="50%" outerRadius="72%" data={radarRows}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar
                        name="Score"
                        dataKey="A"
                        stroke={ACCENT.violet}
                        fill={ACCENT.violet}
                        fillOpacity={0.35}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </RadarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Result count distribution</CardTitle>
                <CardDescription>
                  How many listings were attached to each logged search (bucketed).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.totalSearches < 1 || !distPieRows.some((r) => r.value > 0) ? (
                  <EmptyChart />
                ) : (
                  <ReportStylePieBlock rows={distPieRows} minLabelPercent={0.06} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Backend mix</CardTitle>
                <CardDescription>
                  Report-style pie: white slice borders, labels on larger segments, legend at right.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!backendPieRows.some((r) => r.value > 0) ? (
                  <EmptyChart />
                ) : (
                  <ReportStylePieBlock rows={backendPieRows} minLabelPercent={0.05} />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Category scope</CardTitle>
                <CardDescription>
                  Filtered browse (category on <code className="text-xs">/search</code>) vs open surfboard
                  search.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!categoryPieRows.some((r) => r.value > 0) ? (
                  <EmptyChart />
                ) : (
                  <ReportStylePieBlock rows={categoryPieRows} minLabelPercent={0.05} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top category slugs</CardTitle>
                <CardDescription>When a category filter was present, these slugs dominated.</CardDescription>
              </CardHeader>
              <CardContent className="h-[180px]">
                {!(data.topCategorySlugs?.length) ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No category-tagged searches in this window.
                  </p>
                ) : (
                  <ChartContainer
                    config={{
                      c: {
                        label: "Searches",
                        theme: {
                          light: "hsl(173 58% 36%)",
                          dark: "hsl(173 58% 48%)",
                        },
                      },
                    }}
                    className="h-full w-full"
                  >
                    <BarChart
                      data={[...data.topCategorySlugs].reverse()}
                      layout="vertical"
                      margin={{ left: 4, right: 8, top: 4, bottom: 4 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" tickLine={false} axisLine={false} />
                      <YAxis
                        type="category"
                        dataKey="slug"
                        width={100}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10 }}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="var(--color-c)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Trending momentum (scatter)</CardTitle>
                <CardDescription>
                  Bubble position: recent volume vs velocity. Pair with the trending table below for exact
                  counts.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {trendingScatter.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">
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
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        dataKey="recent"
                        name="Recent"
                        tickLine={false}
                        axisLine={false}
                        label={{ value: "Recent searches (2d)", position: "bottom", offset: 0, fontSize: 11 }}
                      />
                      <YAxis
                        type="number"
                        dataKey="velocity"
                        name="Velocity"
                        tickLine={false}
                        axisLine={false}
                        label={{
                          value: "Velocity",
                          angle: -90,
                          position: "insideLeft",
                          fontSize: 11,
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
                            <div className="rounded-md border bg-background px-2 py-1.5 text-xs shadow-md">
                              <p className="font-medium max-w-[200px] break-words">{row.query}</p>
                              <p className="text-muted-foreground tabular-nums">
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
              </CardContent>
            </Card>

          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top normalized queries</CardTitle>
                <CardDescription>Rank-ordered terms aggregated in Elasticsearch.</CardDescription>
              </CardHeader>
              <CardContent className="pl-0">
                {topBarData.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ChartContainer
                    config={{
                      count: {
                        label: "Searches",
                        theme: {
                          light: "hsl(240 5.9% 10%)",
                          dark: "hsl(0 0% 90%)",
                        },
                      },
                    }}
                    className="h-[min(440px,62vh)] w-full"
                  >
                    <BarChart
                      data={[...topBarData].reverse()}
                      layout="vertical"
                      margin={{ left: 4, right: 16, top: 8, bottom: 8 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" tickLine={false} axisLine={false} />
                      <YAxis
                        type="category"
                        dataKey="short"
                        width={112}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11 }}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="var(--color-count)" />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Trending detail</CardTitle>
                <CardDescription>2-day vs prior 2-day velocity leaderboard.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.trendingQueries.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Needs more recent searches to compute momentum.
                  </p>
                ) : (
                  <div className="overflow-x-auto max-h-[440px] overflow-y-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm border-b">
                        <tr className="text-left text-muted-foreground">
                          <th className="p-2 font-medium">Query</th>
                          <th className="p-2 font-medium text-right">Recent</th>
                          <th className="p-2 font-medium text-right">Prior</th>
                          <th className="p-2 font-medium text-right">v</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.trendingQueries.map((row) => (
                          <tr key={row.query} className="border-b border-border/50 last:border-0">
                            <td className="p-2 max-w-[200px] truncate" title={row.query}>
                              {row.query}
                            </td>
                            <td className="p-2 text-right tabular-nums">{row.recentCount}</td>
                            <td className="p-2 text-right tabular-nums text-muted-foreground">
                              {row.previousCount}
                            </td>
                            <td className="p-2 text-right tabular-nums font-medium">
                              {row.velocity.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Zero-result demand</CardTitle>
              <CardDescription>Queries that logged zero listings — prioritize content or synonyms here.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.zeroResultQueries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No zero-result events in this range.
                </p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm border-b">
                        <tr className="text-left text-muted-foreground">
                          <th className="p-2 font-medium">Query</th>
                          <th className="p-2 font-medium text-right">Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.zeroResultQueries.map((row) => (
                          <tr key={row.query} className="border-b border-border/50 last:border-0">
                            <td className="p-2 max-w-[240px] truncate" title={row.query}>
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
                          theme: {
                            light: "hsl(350 80% 48%)",
                            dark: "hsl(350 70% 55%)",
                          },
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
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="short"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          angle={-28}
                          textAnchor="end"
                          height={52}
                          interval={0}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis tickLine={false} axisLine={false} width={32} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--color-count)" />
                      </BarChart>
                    </ChartContainer>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {data.fetchedAt && (
            <p className="text-xs text-muted-foreground text-center">
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
        </>
      ) : null}
    </div>
  )
}

function TreemapCell(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
  full?: string
  value?: number
  index?: number
}) {
  const { x = 0, y = 0, width = 0, height = 0, name, index = 0 } = props
  if (width < 4 || height < 4) return null
  const fills = [
    "hsl(221.2 83.2% 53.3% / 0.85)",
    "hsl(262 83% 58% / 0.8)",
    "hsl(173 58% 39% / 0.82)",
    "hsl(38 92% 50% / 0.78)",
    "hsl(215 16% 47% / 0.85)",
  ]
  const fill = fills[index % fills.length]
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="hsl(var(--background))" strokeWidth={2} rx={4} />
      {width > 52 && height > 18 ? (
        <text
          x={x + 6}
          y={y + 16}
          className="fill-white text-[11px] drop-shadow-md"
        >
          {name}
        </text>
      ) : null}
    </g>
  )
}

function InsightStat({
  title,
  value,
  hint,
  badge,
  spark,
}: {
  title: string
  value: string
  hint: string
  badge?: string
  spark: { date: string; count: number }[]
}) {
  return (
    <Card className="relative overflow-hidden border-l-4 border-l-primary/60 shadow-sm">
      <CardHeader className="pb-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </CardTitle>
          {badge ? (
            <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">
              {badge}
            </Badge>
          ) : null}
        </div>
        <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
        <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p>
      </CardHeader>
      <CardContent className="pt-0 pb-2">
        {spark.length > 1 ? (
          <ChartContainer
            config={{
              c: {
                label: "Vol",
                theme: {
                  light: "hsl(221.2 83.2% 53.3% / 0.35)",
                  dark: "hsl(217 91% 60% / 0.4)",
                },
              },
            }}
            className="h-12 w-full opacity-90"
          >
            <AreaChart data={spark} margin={{ left: 0, right: 0, top: 2, bottom: 0 }}>
              <Area type="monotone" dataKey="count" stroke="none" fill="var(--color-c)" />
            </AreaChart>
          </ChartContainer>
        ) : null}
      </CardContent>
    </Card>
  )
}

function EmptyChart() {
  return (
    <p className="text-sm text-muted-foreground py-12 text-center">
      No events in this range. Run keyword searches on the marketplace, then refresh.
    </p>
  )
}
