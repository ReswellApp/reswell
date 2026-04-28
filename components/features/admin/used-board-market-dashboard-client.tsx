"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
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
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Tag,
  Timer,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { Separator } from "@/components/ui/separator"
import {
  DASHBOARD_RANGE_OPTIONS,
  type DashboardDimension,
  type DashboardGroupedRow,
  type DashboardKpis,
  type DashboardRangeKey,
  type DashboardSeriesPoint,
  type UsedBoardMarketDashboard,
} from "@/lib/services/usedBoardMarketDashboard.shared"
import { cn } from "@/lib/utils"

const CONDITION_PALETTE = ["#0F172A", "#1E40AF", "#0EA5E9", "#14B8A6", "#F59E0B", "#EF4444"]
const BOARD_TYPE_PALETTE = ["#1E40AF", "#0EA5E9", "#14B8A6", "#A855F7", "#F59E0B", "#EF4444", "#64748B"]

const ALL_VALUE = "all"

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatUsd(value: number | null | undefined, opts?: { compact?: boolean }): string {
  if (value == null || !Number.isFinite(value)) return "—"
  if (opts?.compact) {
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}k`
  }
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  })
}

function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return value.toLocaleString("en-US")
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${(value * 100).toFixed(digits)}%`
}

function formatDays(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  if (value < 1) return "<1 day"
  return `${value.toFixed(value < 10 ? 1 : 0)}d`
}

function changeFor(
  current: number | null | undefined,
  previous: number | null | undefined,
): { change: string; changeType: "positive" | "negative" | "neutral" } {
  if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous)) {
    return { change: "—", changeType: "neutral" }
  }
  if (previous === 0 && current === 0) return { change: "0%", changeType: "neutral" }
  if (previous === 0) return { change: "+∞", changeType: "positive" }
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const rounded = Math.round(pct * 10) / 10
  const sign = rounded > 0 ? "+" : ""
  return {
    change: `${sign}${rounded}%`,
    changeType: rounded > 1 ? "positive" : rounded < -1 ? "negative" : "neutral",
  }
}

function inverseChangeFor(
  current: number | null | undefined,
  previous: number | null | undefined,
): { change: string; changeType: "positive" | "negative" | "neutral" } {
  const c = changeFor(current, previous)
  if (c.changeType === "positive") return { change: c.change, changeType: "negative" }
  if (c.changeType === "negative") return { change: c.change, changeType: "positive" }
  return c
}

function buildKpiSpark(
  series: DashboardSeriesPoint[],
  key: keyof Pick<DashboardSeriesPoint, "newListings" | "sold" | "grossVolume">,
): { count: number }[] {
  return series.map((p) => ({ count: Number(p[key] ?? 0) }))
}

function listingHref(slug: string | null, id: string): string {
  return `/l/${slug?.trim() ? slug.trim() : id}`
}

function capitalize(input: string): string {
  if (!input) return input
  return input.charAt(0).toUpperCase() + input.slice(1)
}

// ---------------------------------------------------------------------------
// URL filter state
// ---------------------------------------------------------------------------

type UrlFilters = {
  range: DashboardRangeKey
  brandId: string | null
  modelSlug: string | null
  variantId: string | null
  boardType: string | null
  condition: string | null
  state: string | null
}

const DEFAULT_FILTERS: UrlFilters = {
  range: "90d",
  brandId: null,
  modelSlug: null,
  variantId: null,
  boardType: null,
  condition: null,
  state: null,
}

function readFiltersFromSearchParams(params: URLSearchParams): UrlFilters {
  const range = params.get("range")
  const validRange = DASHBOARD_RANGE_OPTIONS.find((o) => o.value === range)?.value ?? "90d"
  const brandId = params.get("brandId") || null
  const modelSlug = brandId ? params.get("modelSlug") || null : null
  const variantId = brandId && modelSlug ? params.get("variantId") || null : null
  return {
    range: validRange,
    brandId,
    modelSlug,
    variantId,
    boardType: params.get("boardType") || null,
    condition: params.get("condition") || null,
    state: params.get("state") || null,
  }
}

function buildSearchParamString(filters: UrlFilters): string {
  const params = new URLSearchParams()
  if (filters.range !== "90d") params.set("range", filters.range)
  if (filters.brandId) params.set("brandId", filters.brandId)
  if (filters.modelSlug) params.set("modelSlug", filters.modelSlug)
  if (filters.variantId) params.set("variantId", filters.variantId)
  if (filters.boardType) params.set("boardType", filters.boardType)
  if (filters.condition) params.set("condition", filters.condition)
  if (filters.state) params.set("state", filters.state)
  return params.toString()
}

function activeFilterCount(filters: UrlFilters): number {
  let count = 0
  if (filters.brandId) count++
  if (filters.modelSlug) count++
  if (filters.variantId) count++
  if (filters.boardType) count++
  if (filters.condition) count++
  if (filters.state) count++
  return count
}

// ---------------------------------------------------------------------------
// Reusable bits
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  change,
  changeType,
  subtitle,
  icon,
  trend,
  accent = "primary",
}: {
  label: string
  value: string
  change: string
  changeType: "positive" | "negative" | "neutral"
  subtitle: string
  icon: ReactNode
  trend?: { count: number }[]
  accent?: "primary" | "emerald" | "amber" | "violet"
}) {
  const changeColors = {
    positive: "text-emerald-700 bg-emerald-50 border-emerald-200",
    negative: "text-rose-700 bg-rose-50 border-rose-200",
    neutral: "text-slate-600 bg-slate-50 border-slate-200",
  }
  const accentColor: Record<typeof accent, string> = {
    primary: "#1E40AF",
    emerald: "#10B981",
    amber: "#F59E0B",
    violet: "#8B5CF6",
  }
  const stroke = accentColor[accent]
  const gradId = `kpi-${label.replace(/\s+/g, "-")}-${accent}`
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2 text-slate-500">
            {icon}
            <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-900">{value}</div>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold tabular-nums",
            changeColors[changeType],
          )}
        >
          {change}
        </span>
      </div>
      {trend && trend.length > 1 ? (
        <div className="-mx-1 h-12">
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

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-[160px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
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
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon ? <span className="text-slate-400">{icon}</span> : null}
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        </div>
        {description ? <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p> : null}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </div>
  )
}

function SectionCard({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8",
        className,
      )}
    >
      {children}
    </div>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: swatch }} />
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function UsedBoardMarketDashboardClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const filters = useMemo<UrlFilters>(
    () => readFiltersFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  )

  const [data, setData] = useState<UsedBoardMarketDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initialAttemptDoneRef = useRef(false)

  const updateFilters = useCallback(
    (patch: Partial<UrlFilters>) => {
      const next: UrlFilters = { ...filters, ...patch }
      // Cascading clears
      if ("brandId" in patch && patch.brandId !== filters.brandId) {
        next.modelSlug = null
        next.variantId = null
      }
      if ("modelSlug" in patch && patch.modelSlug !== filters.modelSlug) {
        next.variantId = null
      }
      const qs = buildSearchParamString(next)
      const nextUrl = qs ? `${pathname}?${qs}` : pathname
      startTransition(() => {
        router.replace(nextUrl, { scroll: false })
      })
    },
    [filters, pathname, router, startTransition],
  )

  const clearAllFilters = useCallback(() => {
    startTransition(() => {
      router.replace(`${pathname}?range=${filters.range !== "90d" ? filters.range : ""}`.replace(/[?&]$/, ""), {
        scroll: false,
      })
    })
  }, [filters.range, pathname, router, startTransition])

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      setError(null)
      const firstEver = !initialAttemptDoneRef.current
      if (firstEver) setLoading(true)
      else if (!opts?.silent) setRefreshing(true)
      try {
        const params = new URLSearchParams()
        params.set("range", filters.range)
        if (filters.brandId) params.set("brandId", filters.brandId)
        if (filters.modelSlug) params.set("modelSlug", filters.modelSlug)
        if (filters.variantId) params.set("variantId", filters.variantId)
        if (filters.boardType) params.set("boardType", filters.boardType)
        if (filters.condition) params.set("condition", filters.condition)
        if (filters.state) params.set("state", filters.state)
        const res = await fetch(`/api/admin/used-board-market-dashboard?${params.toString()}`, {
          credentials: "include",
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(typeof body.error === "string" ? body.error : "Could not load dashboard")
          setData(null)
          return
        }
        setData(body.data as UsedBoardMarketDashboard)
      } catch {
        setError("Could not load dashboard")
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
    [filters],
  )

  useEffect(() => {
    void load()
  }, [load])

  const series = data?.series ?? []
  const seriesNewListings = useMemo(() => buildKpiSpark(series, "newListings"), [series])
  const seriesSold = useMemo(() => buildKpiSpark(series, "sold"), [series])
  const seriesGross = useMemo(() => buildKpiSpark(series, "grossVolume"), [series])

  const rangeLabel = useMemo(
    () => DASHBOARD_RANGE_OPTIONS.find((o) => o.value === filters.range)?.label ?? filters.range,
    [filters.range],
  )

  const filterCount = activeFilterCount(filters)

  return (
    <div className="w-full space-y-6 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 sm:p-6 dark:bg-transparent dark:border-border">
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-20 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading used surfboard market dashboard…
        </div>
      ) : data ? (
        <>
          <DashboardHeader
            data={data}
            filters={filters}
            filterCount={filterCount}
            onChangeFilters={updateFilters}
            onClearAll={clearAllFilters}
            refreshing={refreshing}
            onRefresh={() => void load({ silent: false })}
          />

          {filterCount > 0 ? (
            <FilterChipBar
              data={data}
              filters={filters}
              onChangeFilters={updateFilters}
              onClearAll={clearAllFilters}
            />
          ) : null}

          {data.warnings.length > 0 ? (
            <div className="flex flex-wrap items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                {data.warnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
              </div>
            </div>
          ) : null}

          <KpiGrid
            kpis={data.kpis}
            prevKpis={data.prevKpis}
            rangeLabel={rangeLabel}
            seriesNewListings={seriesNewListings}
            seriesSold={seriesSold}
            seriesGross={seriesGross}
          />

          <MarketTrendsCard series={series} rangeLabel={rangeLabel} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <InventoryByBoardTypeCard rows={data.boardTypeRows} />
            <InventoryByConditionCard rows={data.conditionRows} />
          </div>

          <TopByInventoryCard
            rows={data.groupedTopByInventory}
            dimension={data.dimension}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <BestSellersCard
              rows={data.groupedBestSellers}
              dimension={data.dimension}
              rangeLabel={rangeLabel}
            />
            <SlowestMovingCard
              rows={data.groupedSlowestMoving}
              dimension={data.dimension}
              rangeLabel={rangeLabel}
            />
          </div>

          <PriceDistributionCard distribution={data.priceDistribution} rangeLabel={rangeLabel} />

          <GroupPricingTable
            rows={data.groupedPricingTable}
            dimension={data.dimension}
            rangeLabel={rangeLabel}
          />

          <ConditionPricingCard rows={data.conditionRows} rangeLabel={rangeLabel} />

          <LocationPerformanceCard rows={data.locationRows} rangeLabel={rangeLabel} />

          <SoldHistoryTable
            rows={data.soldHistory}
            rangeLabel={rangeLabel}
            totalInRange={data.kpis.totalSoldInRange}
          />

          <VariantCoverageCard coverage={data.variantCoverage} dimension={data.dimension} />

          <SalesEventsStubCard message={data.salesEventsStub.message} />

          <Separator className="bg-slate-200" />

          <p className="text-center text-xs text-slate-500">
            Generated{" "}
            {data.generatedAt
              ? formatDistanceToNow(new Date(data.generatedAt), { addSuffix: true })
              : "just now"}
            {data.rangeFromIso ? (
              <>
                {" "}
                · window {format(parseISO(data.rangeFromIso), "MMM d, yyyy")} –{" "}
                {format(parseISO(data.rangeToIso), "MMM d, yyyy")}
              </>
            ) : (
              <> · all time</>
            )}
          </p>
        </>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Header + filter row + viewing strip
// ---------------------------------------------------------------------------

function DashboardHeader(props: {
  data: UsedBoardMarketDashboard
  filters: UrlFilters
  filterCount: number
  onChangeFilters: (patch: Partial<UrlFilters>) => void
  onClearAll: () => void
  refreshing: boolean
  onRefresh: () => void
}) {
  const { data, filters, refreshing } = props
  const showModel = Boolean(filters.brandId)
  const showVariant = Boolean(filters.brandId && filters.modelSlug)

  const viewingScope = data.viewingScope

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 px-6 py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              Used surfboard market dashboard
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Single source of truth for the used surfboard market. Filters re-scope
              <span className="font-medium text-slate-700"> and re-group </span>
              every section: with no filter the page ranks brands; pick a brand, it ranks models;
              pick a model, it ranks variants.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <div className="text-xs text-slate-500">
                {refreshing ? (
                  <span className="inline-flex items-center gap-1.5 text-blue-600">
                    <Loader2 className="h-3 w-3 animate-spin" /> Updating…
                  </span>
                ) : (
                  "Last updated"
                )}
              </div>
              <div className="font-medium text-slate-700">
                {data.generatedAt
                  ? format(parseISO(data.generatedAt), "MMM d, yyyy h:mm a")
                  : "—"}
              </div>
            </div>
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                refreshing ? "bg-blue-500 animate-pulse" : "bg-emerald-500 animate-pulse",
              )}
              aria-hidden
            />
          </div>
        </div>

        {/* Viewing scope strip */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Viewing
              </p>
              <p className="mt-0.5 truncate text-base font-semibold text-slate-900">
                {viewingScope.primaryLabel}
              </p>
              {viewingScope.secondaryParts.length > 0 ? (
                <p className="mt-0.5 text-xs text-slate-500">
                  {viewingScope.secondaryParts.join(" · ")}
                </p>
              ) : null}
            </div>
            <p className="text-sm font-medium text-slate-700 tabular-nums">
              {viewingScope.activeInventory.toLocaleString()} active ·{" "}
              {viewingScope.soldInRange.toLocaleString()} sold
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <FilterBlock label="Range">
            <Select
              value={filters.range}
              onValueChange={(v) => props.onChangeFilters({ range: v as DashboardRangeKey })}
            >
              <SelectTrigger className="h-9 w-[168px] border-slate-200 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DASHBOARD_RANGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterBlock>

          <FilterBlock label="Brand">
            <Select
              value={filters.brandId ?? ALL_VALUE}
              onValueChange={(v) =>
                props.onChangeFilters({ brandId: v === ALL_VALUE ? null : v })
              }
            >
              <SelectTrigger className="h-9 w-[200px] border-slate-200 bg-white">
                <SelectValue placeholder="All brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All brands</SelectItem>
                {data.filterOptions.brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterBlock>

          {showModel ? (
            <FilterBlock label="Model">
              <Select
                value={filters.modelSlug ?? ALL_VALUE}
                onValueChange={(v) =>
                  props.onChangeFilters({ modelSlug: v === ALL_VALUE ? null : v })
                }
              >
                <SelectTrigger className="h-9 w-[200px] border-slate-200 bg-white">
                  <SelectValue placeholder="All models" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All models</SelectItem>
                  {data.filterOptions.models.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-slate-500">
                      No catalog snapshots for this brand yet
                    </div>
                  ) : (
                    data.filterOptions.models.map((m) => (
                      <SelectItem key={m.slug} value={m.slug}>
                        {m.name} <span className="ml-1 text-xs text-slate-400">· {m.count}</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </FilterBlock>
          ) : null}

          {showVariant ? (
            <FilterBlock label="Variant">
              <Select
                value={filters.variantId ?? ALL_VALUE}
                onValueChange={(v) =>
                  props.onChangeFilters({ variantId: v === ALL_VALUE ? null : v })
                }
              >
                <SelectTrigger className="h-9 w-[260px] border-slate-200 bg-white">
                  <SelectValue placeholder="All variants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All variants</SelectItem>
                  {data.filterOptions.variants.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-slate-500">
                      No converted variants for this model yet
                    </div>
                  ) : (
                    data.filterOptions.variants.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </FilterBlock>
          ) : null}

          <FilterBlock label="Board type">
            <Select
              value={filters.boardType ?? ALL_VALUE}
              onValueChange={(v) =>
                props.onChangeFilters({ boardType: v === ALL_VALUE ? null : v })
              }
            >
              <SelectTrigger className="h-9 w-[180px] border-slate-200 bg-white">
                <SelectValue placeholder="All shapes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All shapes</SelectItem>
                {data.filterOptions.boardTypes.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-slate-500">No shapes in slice</div>
                ) : (
                  data.filterOptions.boardTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label} <span className="ml-1 text-xs text-slate-400">· {t.count}</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </FilterBlock>

          <FilterBlock label="Condition">
            <Select
              value={filters.condition ?? ALL_VALUE}
              onValueChange={(v) =>
                props.onChangeFilters({ condition: v === ALL_VALUE ? null : v })
              }
            >
              <SelectTrigger className="h-9 w-[176px] border-slate-200 bg-white">
                <SelectValue placeholder="Any condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Any condition</SelectItem>
                {data.filterOptions.conditions.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}{" "}
                    {c.count > 0 ? (
                      <span className="ml-1 text-xs text-slate-400">· {c.count}</span>
                    ) : null}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterBlock>

          <FilterBlock label="State">
            <Select
              value={filters.state ?? ALL_VALUE}
              onValueChange={(v) =>
                props.onChangeFilters({ state: v === ALL_VALUE ? null : v })
              }
            >
              <SelectTrigger className="h-9 w-[140px] border-slate-200 bg-white">
                <SelectValue placeholder="All states" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All states</SelectItem>
                {data.filterOptions.states.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-slate-500">No states in slice</div>
                ) : (
                  data.filterOptions.states.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.value} <span className="ml-1 text-xs text-slate-400">· {s.count}</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </FilterBlock>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 border-slate-200 bg-white"
              onClick={props.onRefresh}
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
  )
}

function FilterBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Filter chips
// ---------------------------------------------------------------------------

function FilterChipBar({
  data,
  filters,
  onChangeFilters,
  onClearAll,
}: {
  data: UsedBoardMarketDashboard
  filters: UrlFilters
  onChangeFilters: (patch: Partial<UrlFilters>) => void
  onClearAll: () => void
}) {
  const chips: { key: string; label: string; clear: () => void }[] = []

  if (filters.brandId) {
    const brand = data.filterOptions.brands.find((b) => b.id === filters.brandId)
    chips.push({
      key: "brand",
      label: `Brand: ${brand?.name ?? filters.brandId}`,
      clear: () => onChangeFilters({ brandId: null }),
    })
  }
  if (filters.modelSlug) {
    const model = data.filterOptions.models.find((m) => m.slug === filters.modelSlug)
    chips.push({
      key: "model",
      label: `Model: ${model?.name ?? filters.modelSlug}`,
      clear: () => onChangeFilters({ modelSlug: null }),
    })
  }
  if (filters.variantId) {
    const variant = data.filterOptions.variants.find((v) => v.id === filters.variantId)
    chips.push({
      key: "variant",
      label: `Variant: ${variant?.label ?? "selected"}`,
      clear: () => onChangeFilters({ variantId: null }),
    })
  }
  if (filters.boardType) {
    const bt = data.filterOptions.boardTypes.find((b) => b.value === filters.boardType)
    chips.push({
      key: "boardType",
      label: `Shape: ${bt?.label ?? filters.boardType}`,
      clear: () => onChangeFilters({ boardType: null }),
    })
  }
  if (filters.condition) {
    const c = data.filterOptions.conditions.find((x) => x.value === filters.condition)
    chips.push({
      key: "condition",
      label: `Condition: ${c?.label ?? filters.condition}`,
      clear: () => onChangeFilters({ condition: null }),
    })
  }
  if (filters.state) {
    chips.push({
      key: "state",
      label: `State: ${filters.state}`,
      clear: () => onChangeFilters({ state: null }),
    })
  }

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        Active filters
      </span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.clear}
          className="group inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 transition-colors hover:border-blue-300 hover:bg-blue-100"
        >
          <span>{chip.label}</span>
          <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="ml-1 text-xs font-medium text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline"
      >
        Clear all
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPI grid
// ---------------------------------------------------------------------------

function KpiGrid(props: {
  kpis: DashboardKpis
  prevKpis: DashboardKpis | null
  rangeLabel: string
  seriesNewListings: { count: number }[]
  seriesSold: { count: number }[]
  seriesGross: { count: number }[]
}) {
  const { kpis, prevKpis, rangeLabel } = props

  const newListingChange = changeFor(kpis.totalNewListingsInRange, prevKpis?.totalNewListingsInRange)
  const soldChange = changeFor(kpis.totalSoldInRange, prevKpis?.totalSoldInRange)
  const volumeChange = changeFor(kpis.grossSalesVolumeInRange, prevKpis?.grossSalesVolumeInRange)
  const avgSaleChange = changeFor(kpis.avgSalePriceInRange, prevKpis?.avgSalePriceInRange)
  const sellThroughChange = changeFor(kpis.sellThroughInRange, prevKpis?.sellThroughInRange)
  const daysToSellChange = inverseChangeFor(
    kpis.avgDaysToSellInRange,
    prevKpis?.avgDaysToSellInRange,
  )

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Active inventory"
        value={formatNumber(kpis.totalActiveInventory)}
        change="—"
        changeType="neutral"
        subtitle="Live · not hidden · current"
        icon={<Package className="h-4 w-4" />}
        accent="primary"
      />
      <KpiCard
        label="New listings"
        value={formatNumber(kpis.totalNewListingsInRange)}
        change={newListingChange.change}
        changeType={newListingChange.changeType}
        subtitle={`Created · ${rangeLabel}`}
        icon={<Boxes className="h-4 w-4" />}
        trend={props.seriesNewListings}
        accent="primary"
      />
      <KpiCard
        label="Sold"
        value={formatNumber(kpis.totalSoldInRange)}
        change={soldChange.change}
        changeType={soldChange.changeType}
        subtitle={`Confirmed orders · ${rangeLabel}`}
        icon={<ShoppingBag className="h-4 w-4" />}
        trend={props.seriesSold}
        accent="emerald"
      />
      <KpiCard
        label="Gross volume"
        value={formatUsd(kpis.grossSalesVolumeInRange, { compact: true })}
        change={volumeChange.change}
        changeType={volumeChange.changeType}
        subtitle={`Sale amount sum · ${rangeLabel}`}
        icon={<Wallet className="h-4 w-4" />}
        trend={props.seriesGross}
        accent="emerald"
      />
      <KpiCard
        label="Avg sale price"
        value={formatUsd(kpis.avgSalePriceInRange)}
        change={avgSaleChange.change}
        changeType={avgSaleChange.changeType}
        subtitle={`Median ${formatUsd(kpis.medianSalePriceInRange)}`}
        icon={<TrendingUp className="h-4 w-4" />}
        accent="violet"
      />
      <KpiCard
        label="Median asking"
        value={formatUsd(kpis.medianAskingPriceActive)}
        change="—"
        changeType="neutral"
        subtitle="Active inventory only"
        icon={<Tag className="h-4 w-4" />}
        accent="violet"
      />
      <KpiCard
        label="Avg days to sell"
        value={formatDays(kpis.avgDaysToSellInRange)}
        change={daysToSellChange.change}
        changeType={daysToSellChange.changeType}
        subtitle={`Listing → checkout · ${rangeLabel}`}
        icon={<Timer className="h-4 w-4" />}
        accent="amber"
      />
      <KpiCard
        label="Sell-through"
        value={formatPercent(kpis.sellThroughInRange)}
        change={sellThroughChange.change}
        changeType={sellThroughChange.changeType}
        subtitle="Sold ÷ (active + sold)"
        icon={<Sparkles className="h-4 w-4" />}
        accent="amber"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trends chart
// ---------------------------------------------------------------------------

function MarketTrendsCard({
  series,
  rangeLabel,
}: {
  series: DashboardSeriesPoint[]
  rangeLabel: string
}) {
  const hasData = series.some((p) => p.newListings > 0 || p.sold > 0)
  return (
    <SectionCard>
      <SectionHeader
        title="Market trends"
        description="New listings, sold listings, and gross volume per day across the selected slice."
        icon={<TrendingUp className="h-4 w-4" />}
        trailing={
          <div className="flex flex-wrap gap-2">
            <Legend swatch="#1E40AF" label="New listings" />
            <Legend swatch="#10B981" label="Sold" />
            <Legend swatch="#8B5CF6" label="Gross volume" />
          </div>
        }
      />
      {!hasData ? (
        <EmptyState>No activity recorded for {rangeLabel.toLowerCase()}.</EmptyState>
      ) : (
        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="trend-volume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
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
              <YAxis
                yAxisId="left"
                tick={{ fill: "#64748B", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#E2E8F0" }}
                width={36}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: "#64748B", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#E2E8F0" }}
                width={56}
                tickFormatter={(v) =>
                  typeof v === "number" ? formatUsd(v, { compact: true }) : String(v)
                }
              />
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
                    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white shadow-xl">
                      {labelStr ? (
                        <div className="mb-1.5 border-b border-slate-700 pb-1.5 font-medium text-slate-300">
                          {labelStr}
                        </div>
                      ) : null}
                      {payload.map((p) => {
                        const isVolume = p.dataKey === "grossVolume"
                        const value =
                          typeof p.value === "number"
                            ? isVolume
                              ? formatUsd(p.value)
                              : formatNumber(p.value)
                            : String(p.value ?? "")
                        return (
                          <div
                            key={String(p.dataKey)}
                            className="flex items-center justify-between gap-4"
                          >
                            <span className="flex items-center gap-1.5 font-medium">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: String(p.color ?? "#94a3b8") }}
                              />
                              {p.name ?? String(p.dataKey)}
                            </span>
                            <span className="font-bold text-white tabular-nums">{value}</span>
                          </div>
                        )
                      })}
                    </div>
                  )
                }}
              />
              <Bar
                yAxisId="left"
                dataKey="newListings"
                name="New listings"
                fill="#1E40AF"
                radius={[3, 3, 0, 0]}
                maxBarSize={36}
              />
              <Bar
                yAxisId="left"
                dataKey="sold"
                name="Sold"
                fill="#10B981"
                radius={[3, 3, 0, 0]}
                maxBarSize={36}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="grossVolume"
                name="Gross volume"
                stroke="#8B5CF6"
                strokeWidth={2}
                fill="url(#trend-volume)"
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="grossVolume"
                stroke="#8B5CF6"
                strokeWidth={2}
                dot={false}
                legendType="none"
                name="Gross volume"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Orthogonal supply cards (board type, condition)
// ---------------------------------------------------------------------------

function InventoryByBoardTypeCard({
  rows,
}: {
  rows: UsedBoardMarketDashboard["boardTypeRows"]
}) {
  const data = useMemo(
    () =>
      rows
        .filter((r) => r.activeInventory + r.soldInRange > 0)
        .slice(0, 8)
        .map((r, i) => ({
          name: r.boardTypeLabel || "Unspecified",
          active: r.activeInventory,
          sold: r.soldInRange,
          volume: r.grossVolumeInRange,
          color: BOARD_TYPE_PALETTE[i % BOARD_TYPE_PALETTE.length],
        })),
    [rows],
  )
  return (
    <SectionCard>
      <SectionHeader
        title="Supply by board type"
        description="Active inventory and sold counts grouped by listings.board_type."
      />
      {data.length === 0 ? (
        <EmptyState>No surfboards in inventory for this slice.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-2">
          <ChartContainer
            config={{ active: { label: "Active", color: "#1E40AF" } }}
            className="aspect-square h-[240px] w-full"
          >
            <PieChart>
              <Pie
                data={data}
                dataKey="active"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={56}
                outerRadius="78%"
                paddingAngle={1}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                ))}
              </Pie>
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null
                  const row = payload[0].payload as {
                    name: string
                    active: number
                    sold: number
                    volume: number
                  }
                  return (
                    <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white shadow-xl">
                      <p className="font-medium">{row.name}</p>
                      <p className="mt-1 tabular-nums text-slate-300">
                        {row.active} active · {row.sold} sold
                      </p>
                      <p className="tabular-nums text-slate-300">
                        Gross {formatUsd(row.volume, { compact: true })}
                      </p>
                    </div>
                  )
                }}
              />
            </PieChart>
          </ChartContainer>
          <ul className="space-y-2">
            {data.map((row) => (
              <li
                key={row.name}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-white shadow-sm"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="truncate text-sm font-medium text-slate-800">{row.name}</span>
                </div>
                <p className="mt-1 ml-5 text-xs text-slate-500 tabular-nums">
                  {row.active} active · {row.sold} sold · {row.active + row.sold} total
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  )
}

function InventoryByConditionCard({
  rows,
}: {
  rows: UsedBoardMarketDashboard["conditionRows"]
}) {
  const data = useMemo(
    () =>
      rows
        .filter((r) => r.activeInventory + r.soldInRange > 0)
        .map((r, i) => ({
          name: r.conditionLabel,
          active: r.activeInventory,
          sold: r.soldInRange,
          color: CONDITION_PALETTE[i % CONDITION_PALETTE.length],
        })),
    [rows],
  )
  return (
    <SectionCard>
      <SectionHeader
        title="Supply by condition"
        description="Distribution of active inventory and sold counts across the six sellable condition tiers."
      />
      {data.length === 0 ? (
        <EmptyState>No condition data in this slice.</EmptyState>
      ) : (
        <div className="h-[280px] w-full">
          <ChartContainer
            config={{
              active: { label: "Active", color: "#1E40AF" },
              sold: { label: "Sold", color: "#10B981" },
            }}
            className="h-full w-full"
          >
            <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "#64748B", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval={0}
              />
              <YAxis
                tick={{ fill: "#64748B", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="active" fill="#1E40AF" radius={[3, 3, 0, 0]} />
              <Bar dataKey="sold" fill="#10B981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Regroupable cards (driven by `dimension`)
// ---------------------------------------------------------------------------

function dimensionEmptyState(dim: DashboardDimension): string {
  if (dim.level === "leaf") return "Single selection — drilldowns above carry the analysis."
  return `No ${dim.plural} matched these filters — try broadening your selection.`
}

function TopByInventoryCard({
  rows,
  dimension,
}: {
  rows: DashboardGroupedRow[]
  dimension: DashboardDimension
}) {
  const data = useMemo(
    () =>
      rows
        .filter((r) => r.activeInventory > 0)
        .slice(0, 12)
        .map((r) => ({
          ...r,
          short:
            r.groupLabel.length > 28 ? `${r.groupLabel.slice(0, 26)}…` : r.groupLabel,
        })),
    [rows],
  )
  const title = `Top ${dimension.plural} by active inventory`
  const description = dimension.parentScope
    ? `Active surfboards listed within ${dimension.parentScope}, grouped by ${dimension.singular}.`
    : `How many active surfboards are currently listed per ${dimension.singular}.`
  return (
    <SectionCard>
      <SectionHeader title={title} description={description} icon={<Package className="h-4 w-4" />} />
      {data.length === 0 ? (
        <EmptyState>{dimensionEmptyState(dimension)}</EmptyState>
      ) : (
        <div className="h-[min(420px,60vh)] min-h-[280px] w-full">
          <ChartContainer
            config={{ activeInventory: { label: "Active", color: "#1E40AF" } }}
            className="h-full w-full"
          >
            <BarChart
              data={[...data].reverse()}
              layout="vertical"
              margin={{ left: 4, right: 16, top: 4, bottom: 4 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="short"
                width={172}
                tick={{ fill: "#64748B", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null
                  const row = payload[0].payload as DashboardGroupedRow
                  return (
                    <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white shadow-xl">
                      <p className="font-medium">{row.groupLabel}</p>
                      <p className="mt-1 tabular-nums text-slate-300">
                        Active {row.activeInventory} · Sold {row.soldInRange}
                      </p>
                      <p className="tabular-nums text-slate-300">
                        Median ask {formatUsd(row.medianAskingActive)}
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="activeInventory" fill="#1E40AF" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </SectionCard>
  )
}

function BestSellersCard({
  rows,
  dimension,
  rangeLabel,
}: {
  rows: DashboardGroupedRow[]
  dimension: DashboardDimension
  rangeLabel: string
}) {
  const headerLabel = `Best-selling ${dimension.plural}`
  return (
    <SectionCard>
      <SectionHeader
        title={headerLabel}
        description={`Top ${dimension.plural} by gross sales volume in ${rangeLabel.toLowerCase()}.`}
        icon={<ArrowUpRight className="h-4 w-4 text-emerald-600" />}
      />
      {rows.length === 0 ? (
        <EmptyState>{dimensionEmptyState(dimension)}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">{capitalize(dimension.singular)}</th>
                <th className="px-3 py-2 text-right font-medium">Sold</th>
                <th className="px-3 py-2 text-right font-medium">Gross</th>
                <th className="px-3 py-2 text-right font-medium">Avg sale</th>
                <th className="px-3 py-2 text-right font-medium">Sell-through</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.groupId}
                  className={cn(
                    "border-b border-slate-100 last:border-0",
                    row.isUncatalogued ? "bg-amber-50/40" : null,
                  )}
                >
                  <td className="px-3 py-2 font-medium text-slate-800">
                    {row.groupLabel}
                    {row.isUncatalogued ? (
                      <span className="ml-1 text-[10px] uppercase tracking-wide text-amber-700">
                        · uncatalogued
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(row.soldInRange)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatUsd(row.grossVolumeInRange, { compact: true })}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatUsd(row.avgSalePriceInRange)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatPercent(row.sellThroughInRange)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

function SlowestMovingCard({
  rows,
  dimension,
  rangeLabel,
}: {
  rows: DashboardGroupedRow[]
  dimension: DashboardDimension
  rangeLabel: string
}) {
  const title = `Slowest-moving ${dimension.plural}`
  return (
    <SectionCard>
      <SectionHeader
        title={title}
        description={`${capitalize(dimension.plural)} with ≥3 active boards and the lowest sell-through over ${rangeLabel.toLowerCase()}.`}
        icon={<ArrowDownRight className="h-4 w-4 text-rose-600" />}
      />
      {rows.length === 0 ? (
        <EmptyState>
          Need ≥3 active boards across {dimension.plural} in the slice to compute laggers.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">{capitalize(dimension.singular)}</th>
                <th className="px-3 py-2 text-right font-medium">Active</th>
                <th className="px-3 py-2 text-right font-medium">Sold</th>
                <th className="px-3 py-2 text-right font-medium">Sell-through</th>
                <th className="px-3 py-2 text-right font-medium">Median ask</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.groupId}
                  className={cn(
                    "border-b border-slate-100 last:border-0",
                    row.isUncatalogued ? "bg-amber-50/40" : null,
                  )}
                >
                  <td className="px-3 py-2 font-medium text-slate-800">
                    {row.groupLabel}
                    {row.isUncatalogued ? (
                      <span className="ml-1 text-[10px] uppercase tracking-wide text-amber-700">
                        · uncatalogued
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(row.activeInventory)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(row.soldInRange)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatPercent(row.sellThroughInRange)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatUsd(row.medianAskingActive)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

function GroupPricingTable({
  rows,
  dimension,
  rangeLabel,
}: {
  rows: DashboardGroupedRow[]
  dimension: DashboardDimension
  rangeLabel: string
}) {
  return (
    <SectionCard>
      <SectionHeader
        title={`${capitalize(dimension.singular)} pricing intelligence`}
        description={`Average / median sold price, asking price, and time-to-sell per ${dimension.singular} for ${rangeLabel.toLowerCase()}.`}
        icon={<Tag className="h-4 w-4" />}
      />
      {rows.length === 0 ? (
        <EmptyState>
          {dimension.level === "leaf"
            ? "Single-leaf view — see Sold history for transaction detail."
            : `No ${dimension.plural} sold in this slice.`}
        </EmptyState>
      ) : (
        <div className="max-h-[440px] overflow-x-auto overflow-y-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">{capitalize(dimension.singular)}</th>
                <th className="px-3 py-2 text-right font-medium">Sold</th>
                <th className="px-3 py-2 text-right font-medium">Median sale</th>
                <th className="px-3 py-2 text-right font-medium">Avg sale</th>
                <th className="px-3 py-2 text-right font-medium">Median ask</th>
                <th className="px-3 py-2 text-right font-medium">Spread</th>
                <th className="px-3 py-2 text-right font-medium">Avg days</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const ask = row.medianAskingActive
                const sale = row.medianSalePriceInRange
                const spread =
                  ask != null && sale != null && ask > 0 ? (sale - ask) / ask : null
                return (
                  <tr
                    key={row.groupId}
                    className={cn(
                      "border-b border-slate-100 last:border-0",
                      row.isUncatalogued ? "bg-amber-50/40" : null,
                    )}
                  >
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {row.groupLabel}
                      {row.isUncatalogued ? (
                        <span className="ml-1 text-[10px] uppercase tracking-wide text-amber-700">
                          · uncatalogued
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(row.soldInRange)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatUsd(row.medianSalePriceInRange)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatUsd(row.avgSalePriceInRange)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatUsd(row.medianAskingActive)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums",
                        spread != null && spread < -0.05 ? "text-rose-600" : null,
                        spread != null && spread > 0.05 ? "text-emerald-600" : null,
                      )}
                    >
                      {spread != null ? `${(spread * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatDays(row.avgDaysToSellInRange)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Price distribution + condition pricing
// ---------------------------------------------------------------------------

function PriceDistributionCard({
  distribution,
  rangeLabel,
}: {
  distribution: UsedBoardMarketDashboard["priceDistribution"]
  rangeLabel: string
}) {
  const data = useMemo(() => distribution.map((d) => ({ ...d })), [distribution])
  const hasData = data.some((d) => d.count > 0)

  return (
    <SectionCard>
      <SectionHeader
        title="Sold price distribution"
        description={`How sale prices fall into eight buckets across ${rangeLabel.toLowerCase()}.`}
        icon={<TrendingUp className="h-4 w-4" />}
      />
      {!hasData ? (
        <EmptyState>No sales recorded for {rangeLabel.toLowerCase()}.</EmptyState>
      ) : (
        <div className="h-[280px] w-full">
          <ChartContainer
            config={{ count: { label: "Sales", color: "#1E40AF" } }}
            className="h-full w-full"
          >
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#64748B", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null
                  const row = payload[0].payload as { label: string; count: number; share: number }
                  return (
                    <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white shadow-xl">
                      <p className="font-medium">{row.label}</p>
                      <p className="mt-1 tabular-nums text-slate-300">
                        {row.count} sales · {(row.share * 100).toFixed(1)}%
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="count" fill="#1E40AF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </SectionCard>
  )
}

function ConditionPricingCard({
  rows,
  rangeLabel,
}: {
  rows: UsedBoardMarketDashboard["conditionRows"]
  rangeLabel: string
}) {
  const data = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            r.medianSalePriceInRange != null ||
            r.avgSalePriceInRange != null ||
            r.medianAskingActive != null,
        )
        .map((r, i) => ({
          name: r.conditionLabel,
          medianSale: r.medianSalePriceInRange ?? 0,
          medianAsk: r.medianAskingActive ?? 0,
          avgSale: r.avgSalePriceInRange ?? 0,
          color: CONDITION_PALETTE[i % CONDITION_PALETTE.length],
        })),
    [rows],
  )
  return (
    <SectionCard>
      <SectionHeader
        title="Pricing by condition"
        description={`Median asking vs. median sale price by condition tier for ${rangeLabel.toLowerCase()}.`}
        icon={<Tag className="h-4 w-4" />}
      />
      {data.length === 0 ? (
        <EmptyState>Not enough condition-tagged sales to compare yet.</EmptyState>
      ) : (
        <div className="h-[300px] w-full">
          <ChartContainer
            config={{
              medianSale: { label: "Median sale", color: "#10B981" },
              medianAsk: { label: "Median ask", color: "#1E40AF" },
            }}
            className="h-full w-full"
          >
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "#64748B", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: "#64748B", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v) =>
                  typeof v === "number" ? formatUsd(v, { compact: true }) : String(v)
                }
              />
              <ChartTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white shadow-xl">
                      <p className="font-medium">{String(label ?? "")}</p>
                      <div className="mt-1 space-y-0.5">
                        {payload.map((p) => (
                          <p
                            key={String(p.dataKey)}
                            className="flex items-center justify-between gap-3 tabular-nums text-slate-300"
                          >
                            <span className="flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: String(p.color ?? "#94a3b8") }}
                              />
                              {String(p.name ?? p.dataKey)}
                            </span>
                            <span className="font-bold text-white">
                              {typeof p.value === "number" ? formatUsd(p.value) : String(p.value ?? "")}
                            </span>
                          </p>
                        ))}
                      </div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="medianAsk" fill="#1E40AF" radius={[3, 3, 0, 0]} />
              <Bar dataKey="medianSale" fill="#10B981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Geography + sold history
// ---------------------------------------------------------------------------

function LocationPerformanceCard({
  rows,
  rangeLabel,
}: {
  rows: UsedBoardMarketDashboard["locationRows"]
  rangeLabel: string
}) {
  return (
    <SectionCard>
      <SectionHeader
        title="Geography"
        description={`Top regions by inventory and sales over ${rangeLabel.toLowerCase()}.`}
        icon={<MapPin className="h-4 w-4" />}
      />
      {rows.length === 0 ? (
        <EmptyState>No location data in this slice.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">State</th>
                <th className="px-3 py-2 text-right font-medium">Active</th>
                <th className="px-3 py-2 text-right font-medium">Sold</th>
                <th className="px-3 py-2 text-right font-medium">Gross volume</th>
                <th className="px-3 py-2 text-right font-medium">Avg sale</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.state} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 font-medium text-slate-800">{row.state}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(row.activeInventory)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(row.soldInRange)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatUsd(row.grossVolumeInRange, { compact: true })}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatUsd(row.avgSalePriceInRange)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

function SoldHistoryTable({
  rows,
  rangeLabel,
  totalInRange,
}: {
  rows: UsedBoardMarketDashboard["soldHistory"]
  rangeLabel: string
  totalInRange: number
}) {
  return (
    <SectionCard>
      <SectionHeader
        title="Sold history"
        description={`Confirmed orders attached to surfboard listings in this slice, most recent first. Showing up to ${rows.length.toLocaleString()} of ${totalInRange.toLocaleString()} for ${rangeLabel.toLowerCase()}.`}
        icon={<ShoppingBag className="h-4 w-4" />}
      />
      {rows.length === 0 ? (
        <EmptyState>No sold orders for this slice.</EmptyState>
      ) : (
        <div className="max-h-[520px] overflow-x-auto overflow-y-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[1140px] text-left text-sm">
            <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Sale date</th>
                <th className="px-3 py-2 font-medium">Listing</th>
                <th className="px-3 py-2 font-medium">Brand</th>
                <th className="px-3 py-2 font-medium">Model</th>
                <th className="px-3 py-2 font-medium">Shape</th>
                <th className="px-3 py-2 font-medium">Condition</th>
                <th className="px-3 py-2 font-medium">Location</th>
                <th className="px-3 py-2 text-right font-medium">Asking</th>
                <th className="px-3 py-2 text-right font-medium">Sale price</th>
                <th className="px-3 py-2 text-right font-medium">Days to sell</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Seller / buyer</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const dateStr = (() => {
                  try {
                    return format(parseISO(row.saleDate), "MMM d, yyyy")
                  } catch {
                    return row.saleDate.slice(0, 10)
                  }
                })()
                const isRefunded = row.status === "refunded" || row.status === "refunding"
                return (
                  <tr key={row.orderId} className="border-b border-slate-100 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-700 tabular-nums">
                      {dateStr}
                      {row.orderNum ? (
                        <div className="text-[11px] text-slate-400">#{row.orderNum}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 max-w-[260px]">
                      {row.listing.id ? (
                        <Link
                          href={listingHref(row.listing.slug, row.listing.id)}
                          className="line-clamp-1 font-medium text-slate-800 underline-offset-4 hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {row.listing.title}
                        </Link>
                      ) : (
                        <span className="line-clamp-1 font-medium text-slate-800">
                          {row.listing.title}
                        </span>
                      )}
                      {row.listing.dimensions ? (
                        <div className="text-[11px] text-slate-500">{row.listing.dimensions}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{row.listing.brand ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{row.listing.modelName ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-700 capitalize">
                      {row.listing.boardType?.replace(/[-_]/g, " ") ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-700 capitalize">
                      {row.listing.condition?.replace(/_/g, " ") ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {[row.listing.city, row.listing.state]
                        .filter((p) => p && p.trim())
                        .join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {formatUsd(row.listing.askingPrice)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                      {formatUsd(row.amount)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {row.daysToSell != null ? `${row.daysToSell}d` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
                          isRefunded
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : row.status === "confirmed"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-50 text-slate-600",
                        )}
                      >
                        {row.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      <div>
                        <span className="text-slate-400">S:</span>{" "}
                        {row.seller.displayName ?? "—"}
                      </div>
                      <div>
                        <span className="text-slate-400">B:</span>{" "}
                        {row.buyer.displayName ?? "—"}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Catalog coverage + sales events stub
// ---------------------------------------------------------------------------

function VariantCoverageCard({
  coverage,
  dimension,
}: {
  coverage: UsedBoardMarketDashboard["variantCoverage"]
  dimension: DashboardDimension
}) {
  const has = coverage.totalSnapshotsAllTime > 0
  return (
    <SectionCard>
      <SectionHeader
        title="Catalog coverage"
        description={
          dimension.level === "brand"
            ? "How many recently sold surfboards are mapped to a normalized brand_model_variant. Variant-level rollups will fill in as snapshots get converted."
            : `Catalog coverage within this ${dimension.parentScope ? "scope" : "slice"}. Variant-level analytics rely on conversions from the Board Catalog Data tool.`
        }
        icon={<Boxes className="h-4 w-4" />}
        trailing={
          <Link
            href="/admin/listings/board-catalog-data"
            className="text-xs font-medium text-blue-700 underline-offset-4 hover:underline"
          >
            Open catalog data tool
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Sold (in slice)" value={formatNumber(coverage.totalSoldInRange)} />
        <Stat
          label="Mapped to variant"
          value={formatNumber(coverage.withCatalogVariantInRange)}
          subtext={
            coverage.coverageShareInRange != null
              ? `${(coverage.coverageShareInRange * 100).toFixed(1)}% coverage`
              : "—"
          }
        />
        <Stat
          label={dimension.level === "brand" ? "Snapshots (all time)" : "Snapshots (scope)"}
          value={formatNumber(coverage.totalSnapshotsAllTime)}
        />
        <Stat
          label="Linked to variant"
          value={formatNumber(coverage.withVariantAllTime)}
          subtext={
            coverage.totalSnapshotsAllTime > 0
              ? `${(
                  (coverage.withVariantAllTime / coverage.totalSnapshotsAllTime) *
                  100
                ).toFixed(1)}% of snapshots`
              : "—"
          }
        />
      </div>
      {!has ? (
        <p className="mt-4 text-xs text-slate-500">
          No catalog snapshots in scope yet. Variant-level pricing rollups will populate once
          sellers start using the catalog flow.
        </p>
      ) : coverage.topModels.length > 0 ? (
        <div className="mt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Top models in catalog snapshots (slice)
          </p>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Model</th>
                  <th className="px-3 py-2 text-right font-medium">Sold</th>
                  <th className="px-3 py-2 text-right font-medium">Avg sold price</th>
                </tr>
              </thead>
              <tbody>
                {coverage.topModels.map((row) => (
                  <tr key={row.modelName} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 font-medium text-slate-800">{row.modelName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(row.count)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatUsd(row.avgSoldPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </SectionCard>
  )
}

function Stat({
  label,
  value,
  subtext,
}: {
  label: string
  value: string
  subtext?: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{value}</p>
      {subtext ? <p className="mt-0.5 text-[11px] text-slate-500">{subtext}</p> : null}
    </div>
  )
}

function SalesEventsStubCard({ message }: { message: string }) {
  return (
    <SectionCard className="border-dashed bg-slate-50">
      <SectionHeader
        title="Sales events & promotions"
        description="Reserved space for promotional sale events. Empty until that data is wired up."
        icon={<Sparkles className="h-4 w-4" />}
      />
      <p className="text-sm text-slate-600">{message}</p>
    </SectionCard>
  )
}
