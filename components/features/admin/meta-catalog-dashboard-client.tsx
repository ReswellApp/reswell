"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  Eye,
  Filter,
  Gauge,
  Link2,
  MousePointerClick,
  Package,
  RadioTower,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Wifi,
  WifiOff,
  X,
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
import { cn } from "@/lib/utils"
import type {
  MetaCatalogInsights,
  MetaProductStatus,
} from "@/lib/services/metaCatalogInsights"
import type {
  MetaCatalogProductDetail,
  MetaProductPerformanceRow,
} from "@/lib/meta/catalog-api"

const ALL = "all"
const RANGE_OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 28, label: "Last 28 days" },
  { value: 90, label: "Last 90 days" },
] as const

type PillTone = "slate" | "blue" | "teal" | "amber" | "emerald" | "rose" | "violet"
type Accent = "primary" | "sky" | "teal" | "amber" | "violet" | "rose" | "emerald"

const STATUS_META: Record<MetaProductStatus, { label: string; tone: PillTone; fill: string }> = {
  approved: { label: "Approved", tone: "emerald", fill: "#10b981" },
  pending: { label: "Pending", tone: "amber", fill: "#f59e0b" },
  rejected: { label: "Rejected", tone: "rose", fill: "#ef4444" },
  outdated: { label: "Outdated", tone: "violet", fill: "#8b5cf6" },
  unknown: { label: "Unknown", tone: "slate", fill: "#94a3b8" },
}

const META_BLUE = "#1877f2"

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("en-US")
}

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

function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—"
  return `${(value * 100).toFixed(digits)}%`
}

function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}

function productHref(row: { retailerId: string; url: string | null }): string {
  return row.url?.trim() || `/l/${row.retailerId}`
}

// ---------------------------------------------------------------------------
// PRO design-language primitives
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  subtitle,
  icon,
  accent,
}: {
  label: string
  value: string
  subtitle?: string
  icon: ReactNode
  accent: Accent
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
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <span className={cn("absolute inset-y-0 left-0 w-1", accentBar[accent])} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
          {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
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

function Pill({ children, tone = "slate", title }: { children: ReactNode; tone?: PillTone; title?: string }) {
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
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

function StatusBadge({ status }: { status: MetaProductStatus }) {
  const meta = STATUS_META[status]
  return <Pill tone={meta.tone}>{meta.label}</Pill>
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[140px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-sm text-slate-500">
      {children}
    </div>
  )
}

function ProgressMeter({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? value / total : 0
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <span className="text-xs tabular-nums text-slate-500">
          {formatNumber(value)}/{formatNumber(total)} · {formatPercent(pct, 0)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct >= 0.9 ? "bg-emerald-500" : pct >= 0.5 ? "bg-amber-500" : "bg-rose-500",
          )}
          style={{ width: `${Math.max(pct * 100, value > 0 ? 4 : 0)}%` }}
        />
      </div>
    </div>
  )
}

function ConnectionChip({ ok, label, mutedLabel }: { ok: boolean; label: string; mutedLabel?: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {ok ? <Wifi className="h-3.5 w-3.5 text-emerald-600" /> : <WifiOff className="h-3.5 w-3.5 text-slate-400" />}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{ok ? label : mutedLabel ?? label}</span>
    </span>
  )
}

const CHART_TOOLTIP_STYLE = {
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
} as const

// ---------------------------------------------------------------------------
// Merged row type
// ---------------------------------------------------------------------------

type MergedRow = MetaCatalogProductDetail & {
  clicks: number
  impressions: number
  spend: number
  ctr: number
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function MetaCatalogDashboardClient({
  initialInsights,
}: {
  initialInsights: MetaCatalogInsights
}) {
  const [insights, setInsights] = useState<MetaCatalogInsights>(initialInsights)
  const [rangeDays, setRangeDays] = useState<number>(initialInsights.rangeDays)
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>(ALL)
  const [issuesOnly, setIssuesOnly] = useState(false)
  const [banner, setBanner] = useState<{ tone: "ok" | "error"; text: string } | null>(null)

  const fetchInsights = useCallback(async (days: number) => {
    setLoading(true)
    setBanner(null)
    try {
      const res = await fetch(`/api/admin/meta-catalog/insights?days=${days}`, { cache: "no-store" })
      const json = (await res.json()) as { data?: MetaCatalogInsights; error?: string }
      if (!res.ok || !json.data) {
        setBanner({ tone: "error", text: json.error || "Failed to load insights." })
        return
      }
      startTransition(() => setInsights(json.data as MetaCatalogInsights))
    } catch {
      setBanner({ tone: "error", text: "Network error loading insights." })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (rangeDays !== insights.rangeDays) void fetchInsights(rangeDays)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays])

  const perfByProduct = useMemo(() => {
    const map = new Map<string, MetaProductPerformanceRow>()
    if (insights.performance.configured) {
      for (const row of insights.performance.byProduct) map.set(row.productId, row)
    }
    return map
  }, [insights.performance])

  const rows = useMemo<MergedRow[]>(() => {
    return insights.products.map((product) => {
      const perf = perfByProduct.get(product.retailerId)
      return {
        ...product,
        clicks: perf?.clicks ?? 0,
        impressions: perf?.impressions ?? 0,
        spend: perf?.spend ?? 0,
        ctr: perf?.ctr ?? 0,
      }
    })
  }, [insights.products, perfByProduct])

  const perfConfigured = insights.performance.configured

  const decisions = useMemo(() => {
    const rejected = rows.filter((r) => r.reviewStatus === "rejected")
    const outdated = rows.filter((r) => r.reviewStatus === "outdated")
    const topPerformers = perfConfigured
      ? [...rows].filter((r) => r.clicks > 0).sort((a, b) => b.clicks - a.clicks).slice(0, 8)
      : []
    return { rejected, outdated, topPerformers }
  }, [rows, perfConfigured])

  const statusData = useMemo(() => {
    const s = insights.summary
    return (
      [
        { name: "Approved", value: s.approved, fill: STATUS_META.approved.fill },
        { name: "Pending", value: s.pending, fill: STATUS_META.pending.fill },
        { name: "Rejected", value: s.rejected, fill: STATUS_META.rejected.fill },
        { name: "Outdated", value: s.outdated, fill: STATUS_META.outdated.fill },
        { name: "Unknown", value: s.unknown, fill: STATUS_META.unknown.fill },
      ] as const
    ).filter((d) => d.value > 0)
  }, [insights.summary])

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter((r) => {
        if (statusFilter !== ALL && r.reviewStatus !== statusFilter) return false
        if (issuesOnly && r.errors.length === 0) return false
        if (q) {
          const hay = `${r.name ?? ""} ${r.brand ?? ""} ${r.retailerId}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => b.clicks - a.clicks || b.errors.length - a.errors.length)
  }, [rows, search, statusFilter, issuesOnly])

  const filtersActive = search.trim().length > 0 || statusFilter !== ALL || issuesOnly

  const exportCsv = useCallback(() => {
    const header = [
      "retailer_id",
      "name",
      "brand",
      "review_status",
      "availability",
      "price",
      "errors",
      "clicks",
      "impressions",
      "spend",
      "ctr",
      "url",
    ]
    const lines = [header.join(",")]
    for (const r of rows) {
      lines.push(
        [
          r.retailerId,
          r.name ?? "",
          r.brand ?? "",
          r.reviewStatus,
          r.availability ?? "",
          r.price ?? "",
          r.errors.length,
          r.clicks,
          r.impressions,
          r.spend.toFixed(2),
          r.ctr.toFixed(4),
          productHref(r),
        ]
          .map(csvEscape)
          .join(","),
      )
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `reswell-meta-catalog-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [rows])

  const commerceManagerUrl = insights.catalog.catalogId
    ? `https://business.facebook.com/commerce/catalogs/${insights.catalog.catalogId}/products`
    : "https://business.facebook.com/commerce_manager"

  const perf = insights.performance
  const coverage = insights.coverage
  const summary = insights.summary
  const totalProducts = summary.total

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                <ShoppingBag className="h-7 w-7" style={{ color: META_BLUE }} />
                Meta Catalog
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                Pro
              </span>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Feed health, product review status, item-level issues, Advantage+ catalog ad
              performance, and Pixel/CAPI status for every product on Facebook &amp; Instagram Shops.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <ConnectionChip ok={insights.configured} label="Catalog API connected" mutedLabel="Catalog API not connected" />
              <ConnectionChip ok={Boolean(insights.pixel.pixelId)} label={`Pixel ${insights.pixel.pixelId ?? ""}`} mutedLabel="Pixel not set" />
              <ConnectionChip ok={insights.pixel.capiEnabled} label="CAPI on" mutedLabel="CAPI off" />
              <ConnectionChip ok={insights.catalog.adsConnected} label="Ads connected" mutedLabel="Ads not connected" />
              {insights.catalog.catalogId ? (
                <span className="font-mono">catalog {insights.catalog.catalogId}</span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Select value={String(rangeDays)} onValueChange={(v) => setRangeDays(Number(v))}>
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5" disabled={rows.length === 0}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => fetchInsights(rangeDays)} disabled={loading} className="gap-1.5">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
            <a
              href={commerceManagerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              <ExternalLink className="h-4 w-4" />
              Commerce Manager
            </a>
          </div>
        </div>

        {banner ? (
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm",
              banner.tone === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800",
            )}
          >
            {banner.tone === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            <span>{banner.text}</span>
            <button type="button" onClick={() => setBanner(null)} className="ml-auto rounded p-1 hover:bg-black/5" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      {/* KPI grid — feed + pixel always available; catalog/ads KPIs populate when connected */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Eligible listings"
          value={formatNumber(insights.feed.eligibleListings)}
          subtitle="surfboards that qualify for the feed"
          icon={<Package className="h-5 w-5" />}
          accent="primary"
        />
        <KpiCard
          label="Products in catalog"
          value={insights.configured ? formatNumber(coverage.productsInCatalog) : "—"}
          subtitle={
            insights.configured
              ? `${formatNumber(coverage.syncedEligible)} of ${formatNumber(coverage.eligibleListings)} eligible synced`
              : "connect Catalog API"
          }
          icon={<ShoppingBag className="h-5 w-5" />}
          accent="sky"
        />
        <KpiCard
          label="Approved"
          value={insights.configured ? formatNumber(summary.approved) : "—"}
          subtitle={insights.configured ? `${formatPercent(totalProducts > 0 ? summary.approved / totalProducts : 0, 0)} of catalog` : "connect Catalog API"}
          icon={<BadgeCheck className="h-5 w-5" />}
          accent="emerald"
        />
        <KpiCard
          label="Needs attention"
          value={insights.configured ? formatNumber(summary.rejected + summary.outdated) : "—"}
          subtitle={insights.configured ? `${formatNumber(summary.rejected)} rejected · ${formatNumber(summary.outdated)} outdated` : "connect Catalog API"}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent="rose"
        />
        <KpiCard
          label="Item issues"
          value={insights.configured ? formatNumber(summary.totalErrors) : "—"}
          subtitle={insights.configured ? `${formatNumber(summary.withErrors)} products affected` : "connect Catalog API"}
          icon={<Filter className="h-5 w-5" />}
          accent="amber"
        />
        <KpiCard
          label="Clicks"
          value={perf.configured ? formatNumber(perf.totals.clicks) : "—"}
          subtitle={perf.configured ? `last ${perf.rangeDays} days` : "connect Ads"}
          icon={<MousePointerClick className="h-5 w-5" />}
          accent="sky"
        />
        <KpiCard
          label="Impressions"
          value={perf.configured ? formatNumber(perf.totals.impressions) : "—"}
          subtitle={perf.configured ? `CTR ${formatPercent(perf.totals.ctr)}` : "connect Ads"}
          icon={<Eye className="h-5 w-5" />}
          accent="violet"
        />
        <KpiCard
          label="Ad spend"
          value={perf.configured ? formatUsd(perf.totals.spend, { compact: true }) : "—"}
          subtitle={perf.configured ? "Advantage+ catalog ads" : "connect Ads"}
          icon={<Gauge className="h-5 w-5" />}
          accent="teal"
        />
      </div>

      {!insights.configured ? (
        <SetupState reason={insights.reason} pixel={insights.pixel} />
      ) : (
        <>
          {/* Performance + status */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SectionCard className="lg:col-span-2">
              <SectionHeader
                title="Advantage+ catalog ad performance"
                description={`Clicks and impressions per day from Meta Ads (product_id breakdown), last ${rangeDays} days.`}
                icon={<TrendingUp className="h-4 w-4" />}
              />
              {perf.configured && perf.daily.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={perf.daily} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="metaImpr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="metaClicks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={META_BLUE} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={META_BLUE} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={formatDateLabel} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} minTickGap={24} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                    <RechartsTooltip contentStyle={CHART_TOOLTIP_STYLE} labelFormatter={(l) => formatDateLabel(String(l))} />
                    <Area type="monotone" dataKey="impressions" name="Impressions" stroke="#8b5cf6" strokeWidth={2} fill="url(#metaImpr)" />
                    <Area type="monotone" dataKey="clicks" name="Clicks" stroke={META_BLUE} strokeWidth={2} fill="url(#metaClicks)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>
                  {perf.configured
                    ? "No catalog ad activity in this window."
                    : `${perf.reason} Add META_ADS_ACCOUNT_ID to see per-product clicks.`}
                </EmptyState>
              )}
            </SectionCard>

            <SectionCard>
              <SectionHeader title="Review status" description="How your catalog breaks down across Meta's review." icon={<CheckCircle2 className="h-4 w-4" />} />
              {statusData.length > 0 ? (
                <div className="relative">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <RechartsTooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        formatter={(v: number | string, name: string) => [
                          `${formatNumber(Number(v))} (${formatPercent(Number(v) / Math.max(totalProducts, 1), 0)})`,
                          name,
                        ]}
                      />
                      <Pie data={statusData as { name: string; value: number; fill: string }[]} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={2} stroke="none">
                        {statusData.map((d) => (
                          <Cell key={d.name} fill={d.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold tabular-nums text-slate-900">{formatNumber(totalProducts)}</span>
                    <span className="text-[11px] uppercase tracking-wide text-slate-500">products</span>
                  </div>
                </div>
              ) : (
                <EmptyState>No products in the catalog yet.</EmptyState>
              )}
              <ul className="mt-3 space-y-1.5">
                {statusData.map((d) => (
                  <li key={d.name} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.fill }} />
                      <span className="text-slate-600">{d.name}</span>
                    </span>
                    <span className="tabular-nums text-slate-500">{formatNumber(d.value)}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          {/* Decisions */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DecisionPanel
              title="Rejected — fix to restore reach"
              description="Products Meta is refusing to show. Resolve the issue; the next feed pull re-reviews them."
              icon={<AlertTriangle className="h-4 w-4" />}
              tone="rose"
              entries={decisions.rejected.map((r) => ({
                ...toDecisionItem(r),
                metric: `${r.errors.length} issue${r.errors.length === 1 ? "" : "s"}`,
              }))}
            />
            <DecisionPanel
              title="Outdated — needs a fresh pull"
              description="Meta's copy is stale. A feed refresh or re-upload will revalidate these."
              icon={<Clock3 className="h-4 w-4" />}
              tone="violet"
              entries={decisions.outdated.map((r) => ({ ...toDecisionItem(r), metric: "outdated" }))}
            />
            <DecisionPanel
              title="Eligible but missing from catalog"
              description="Live Reswell listings Meta hasn't ingested yet — check feed schedule / pixel match."
              icon={<Package className="h-4 w-4" />}
              tone="amber"
              entries={coverage.missingFromCatalog.map((m) => ({
                retailerId: m.retailerId,
                name: m.title,
                url: m.link,
                metric: "not in catalog",
              }))}
            />
            <DecisionPanel
              title="Top performers"
              description="Best-clicking products in catalog ads — protect pricing and inventory."
              icon={<TrendingUp className="h-4 w-4" />}
              tone="emerald"
              entries={decisions.topPerformers.map((r) => ({
                ...toDecisionItem(r),
                metric: `${formatNumber(r.clicks)} clicks · ${formatPercent(r.ctr)}`,
              }))}
              disabled={!perfConfigured}
            />
          </div>

          {/* Issues + coverage */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard>
              <SectionHeader title="Top item-level issues" description="Grouped across the catalog, most frequent first." icon={<AlertTriangle className="h-4 w-4" />} />
              {insights.topIssues.length === 0 ? (
                <EmptyState>No item-level issues. Your catalog is clean.</EmptyState>
              ) : (
                <ul className="space-y-2">
                  {insights.topIssues.slice(0, 8).map((issue) => {
                    const isFatal = (issue.severity ?? "").toUpperCase() === "FATAL"
                    return (
                      <li key={issue.type} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                        <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md", isFatal ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600")}>
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-slate-900">{issue.message}</span>
                            <Pill tone={isFatal ? "rose" : "amber"}>{issue.count}</Pill>
                          </div>
                          <p className="mt-0.5 font-mono text-[11px] text-slate-400">{issue.type}</p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </SectionCard>

            <SectionCard>
              <SectionHeader title="Catalog coverage" description="Eligible Reswell listings vs. what's live in the Meta catalog." icon={<Package className="h-4 w-4" />} />
              <div className="space-y-3">
                <ProgressMeter label="Eligible listings synced" value={coverage.syncedEligible} total={coverage.eligibleListings} />
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <CoverageStat label="Eligible" value={coverage.eligibleListings} tone="blue" />
                  <CoverageStat label="In catalog" value={coverage.productsInCatalog} tone="emerald" />
                  <CoverageStat label="Orphans" value={coverage.orphanRetailerIds.length} tone="amber" />
                </div>
              </div>
              {coverage.missingFromCatalog.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Eligible but missing ({coverage.missingFromCatalog.length})
                  </p>
                  <ul className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                    {coverage.missingFromCatalog.slice(0, 25).map((m) => (
                      <li key={m.retailerId} className="flex items-center justify-between gap-2 text-sm">
                        <a href={m.link} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1.5 truncate text-slate-700 hover:text-blue-600">
                          <Link2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{m.title}</span>
                        </a>
                        <span className="shrink-0 tabular-nums text-slate-500">{m.price}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-slate-500">
                    Meta pulls the feed on a schedule — these usually appear after the next fetch.
                  </p>
                </div>
              ) : (
                <p className="mt-4 flex items-center gap-1.5 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Every eligible listing is in the catalog.
                </p>
              )}
            </SectionCard>
          </div>

          {/* Pixel / CAPI */}
          <PixelPanel pixel={insights.pixel} />

          {/* Product table */}
          <SectionCard className="p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products by name, brand, or retailer id…" className="pl-9" />
                {search ? (
                  <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Clear search">
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All statuses</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="outdated">Outdated</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => setIssuesOnly((v) => !v)}
                  className={cn(
                    "h-9 rounded-md border px-3 text-xs font-medium transition-colors",
                    issuesOnly ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-600 hover:bg-slate-50",
                  )}
                >
                  With issues
                </button>
                {filtersActive ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearch("")
                      setStatusFilter(ALL)
                      setIssuesOnly(false)
                    }}
                    className="h-9 text-xs text-slate-500"
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Clear
                  </Button>
                ) : null}
                <span className="ml-auto text-xs tabular-nums text-slate-500">
                  {formatNumber(visibleRows.length)} of {formatNumber(rows.length)}
                </span>
              </div>
            </div>

            {visibleRows.length === 0 ? (
              <EmptyState>{rows.length === 0 ? "No products in the catalog yet." : "No products match the filters."}</EmptyState>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[880px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2 font-medium">Product</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Availability</th>
                      <th className="px-3 py-2 text-right font-medium">Issues</th>
                      <th className="px-3 py-2 text-right font-medium">Clicks</th>
                      <th className="px-3 py-2 text-right font-medium">Impr.</th>
                      <th className="px-3 py-2 text-right font-medium">Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.slice(0, 200).map((r) => (
                      <tr key={r.retailerId || r.productId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                        <td className="px-3 py-2 align-top">
                          <a href={productHref(r)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-slate-800 hover:text-blue-600">
                            {r.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.imageUrl} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-md border border-slate-200 object-cover" />
                            ) : (
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-300">
                                <Package className="h-4 w-4" />
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block max-w-[280px] truncate font-medium">{r.name ?? "(untitled)"}</span>
                              <span className="block font-mono text-[11px] text-slate-400">
                                {r.brand ? `${r.brand} · ` : ""}
                                {shortId(r.retailerId)}
                              </span>
                            </span>
                          </a>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <StatusBadge status={r.reviewStatus} />
                        </td>
                        <td className="px-3 py-2 align-top text-slate-600">{r.availability ?? "—"}</td>
                        <td className="px-3 py-2 text-right align-top tabular-nums">
                          {r.errors.length > 0 ? <Pill tone="rose">{r.errors.length}</Pill> : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right align-top tabular-nums font-medium text-slate-900">{perfConfigured ? formatNumber(r.clicks) : "—"}</td>
                        <td className="px-3 py-2 text-right align-top tabular-nums text-slate-600">{perfConfigured ? formatNumber(r.impressions) : "—"}</td>
                        <td className="px-3 py-2 text-right align-top tabular-nums text-slate-600">{perfConfigured ? formatUsd(r.spend) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {visibleRows.length > 200 ? (
                  <p className="border-t border-slate-100 px-3 py-2 text-center text-xs text-slate-400">
                    Showing first 200 of {formatNumber(visibleRows.length)} — refine filters or export CSV for the rest.
                  </p>
                ) : null}
              </div>
            )}
          </SectionCard>

          <p className="pt-2 text-center text-xs text-slate-400">
            Live snapshot · generated {new Date(insights.generatedAt).toLocaleString()} · trailing {rangeDays} days
          </p>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CoverageStat({ label, value, tone }: { label: string; value: number; tone: PillTone }) {
  const tones: Record<PillTone, string> = {
    slate: "text-slate-700",
    blue: "text-blue-700",
    teal: "text-teal-700",
    amber: "text-amber-700",
    emerald: "text-emerald-700",
    rose: "text-rose-700",
    violet: "text-violet-700",
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-center">
      <p className={cn("text-xl font-bold tabular-nums", tones[tone])}>{formatNumber(value)}</p>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  )
}

type DecisionItem = { retailerId: string; name: string | null; url: string | null; imageUrl?: string | null }
type DecisionEntry = DecisionItem & { metric: string }

function toDecisionItem(r: MergedRow): DecisionItem {
  return { retailerId: r.retailerId, name: r.name, url: r.url, imageUrl: r.imageUrl }
}

function DecisionPanel({
  title,
  description,
  icon,
  tone,
  entries,
  disabled,
}: {
  title: string
  description: string
  icon: ReactNode
  tone: PillTone
  entries: DecisionEntry[]
  disabled?: boolean
}) {
  const items = entries

  return (
    <SectionCard>
      <SectionHeader title={title} description={description} icon={icon} />
      {disabled ? (
        <EmptyState>Connect Meta Ads to see this.</EmptyState>
      ) : items.length === 0 ? (
        <div className="flex min-h-[100px] items-center justify-center rounded-md border border-dashed border-emerald-200 bg-emerald-50/40 p-4 text-center text-sm text-emerald-700">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Nothing here — all clear.
          </span>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.slice(0, 8).map((r) => (
            <li key={r.retailerId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
              <a href={r.url?.trim() || `/l/${r.retailerId}`} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 text-slate-700 hover:text-blue-600">
                {r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.imageUrl} alt="" loading="lazy" className="h-8 w-8 shrink-0 rounded-md border border-slate-200 object-cover" />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-300">
                    <Package className="h-3.5 w-3.5" />
                  </span>
                )}
                <span className="truncate text-sm font-medium">{r.name ?? shortId(r.retailerId)}</span>
              </a>
              <Pill tone={tone}>{r.metric}</Pill>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

function PixelPanel({ pixel }: { pixel: MetaCatalogInsights["pixel"] }) {
  return (
    <SectionCard>
      <SectionHeader
        title="Meta Pixel & Conversions API"
        description="Events that power dynamic ads and catalog matching. content_ids are aligned to your listing ids."
        icon={<RadioTower className="h-4 w-4" />}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Pixel</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
            {pixel.pixelId ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="font-mono">{pixel.pixelId}</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-slate-300" />
                <span className="text-slate-500">Not set</span>
              </>
            )}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Conversions API</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
            <span className={cn("h-2 w-2 rounded-full", pixel.capiEnabled ? "bg-emerald-500" : "bg-slate-300")} />
            <span className={pixel.capiEnabled ? "text-slate-800" : "text-slate-500"}>{pixel.capiEnabled ? "Server events on" : "Off"}</span>
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Test mode</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
            <span className={cn("h-2 w-2 rounded-full", pixel.testEventCodeSet ? "bg-amber-500" : "bg-slate-300")} />
            <span className={pixel.testEventCodeSet ? "text-amber-700" : "text-slate-500"}>{pixel.testEventCodeSet ? "Test events only" : "Live"}</span>
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Reswell fires <span className="font-medium text-slate-700">ViewContent</span>, <span className="font-medium text-slate-700">AddToCart</span>, and{" "}
        <span className="font-medium text-slate-700">Purchase</span> (browser pixel + deduplicated server CAPI) keyed on the listing id.
      </p>
    </SectionCard>
  )
}

function SetupState({ reason, pixel }: { reason?: string; pixel: MetaCatalogInsights["pixel"] }) {
  return (
    <>
      <SectionCard>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50" style={{ color: META_BLUE }}>
            <ShoppingBag className="h-7 w-7" />
          </span>
          <div className="max-w-xl space-y-2">
            <h3 className="text-lg font-semibold text-slate-900">Connect the Meta Catalog API</h3>
            <p className="text-sm text-slate-500">
              {reason ||
                "The Catalog Graph API isn't connected. Your CSV feed still works — connect the API to see live review status, item-level issues, and catalog coverage here."}
            </p>
          </div>
          <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-slate-50/60 p-4 text-left">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Required environment</p>
            <ul className="space-y-1 font-mono text-[12px] text-slate-600">
              <li>META_CATALOG_ID</li>
              <li>META_CATALOG_ACCESS_TOKEN (system user · catalog_management)</li>
              <li>META_ADS_ACCOUNT_ID + META_ADS_ACCESS_TOKEN (optional — for clicks)</li>
            </ul>
          </div>
          <a href="https://developers.facebook.com/docs/marketing-api/catalog" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
            Meta Catalog API guide
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </SectionCard>
      <PixelPanel pixel={pixel} />
    </>
  )
}
