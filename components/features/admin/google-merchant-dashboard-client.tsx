"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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
  BarChart3,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  Filter,
  Gauge,
  LineChart as LineChartIcon,
  Link2,
  MousePointerClick,
  Package,
  RefreshCw,
  Search,
  ShoppingCart,
  Sparkles,
  Target,
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
  GoogleMerchantChannelStatus,
  GoogleMerchantInsights,
  GoogleMerchantOptimizationImpact,
  GoogleMerchantPerformanceRow,
  GoogleMerchantProductDetail,
  GoogleMerchantProductOptimization,
  GoogleMerchantProductStatus,
} from "@/lib/services/googleMerchantInsights"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL = "all"
const RANGE_OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 28, label: "Last 28 days" },
  { value: 90, label: "Last 90 days" },
] as const

const STATUS_META: Record<
  GoogleMerchantProductStatus,
  { label: string; tone: PillTone; fill: string }
> = {
  approved: { label: "Approved", tone: "emerald", fill: "#10b981" },
  pending: { label: "Pending", tone: "amber", fill: "#f59e0b" },
  disapproved: { label: "Disapproved", tone: "rose", fill: "#ef4444" },
  no_destination: { label: "Not targeted", tone: "slate", fill: "#94a3b8" },
}

const CHANNEL_META: Record<GoogleMerchantChannelStatus, { label: string; tone: PillTone }> = {
  approved: { label: "Approved", tone: "emerald" },
  pending: { label: "Pending", tone: "amber" },
  disapproved: { label: "Disapproved", tone: "rose" },
  not_targeted: { label: "Not targeted", tone: "slate" },
}

/** Impressions above which a zero-click product is flagged as a CTR problem. */
const LOW_CTR_IMPRESSION_FLOOR = 50

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

function microsToUsd(micros: number | null): number | null {
  if (micros == null) return null
  return micros / 1_000_000
}

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

// ---------------------------------------------------------------------------
// PRO design-language primitives
// ---------------------------------------------------------------------------

type Accent = "primary" | "sky" | "teal" | "amber" | "violet" | "rose" | "emerald"
type PillTone = "slate" | "blue" | "teal" | "amber" | "emerald" | "rose" | "violet"

function KpiCard({
  label,
  value,
  subtitle,
  icon,
  accent,
  footer,
}: {
  label: string
  value: string
  subtitle?: string
  icon: ReactNode
  accent: Accent
  footer?: ReactNode
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
      {footer ? <div className="mt-3">{footer}</div> : null}
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

function Pill({
  children,
  tone = "slate",
  title,
}: {
  children: ReactNode
  tone?: PillTone
  title?: string
}) {
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

function ChannelBadge({
  channel,
  status,
}: {
  channel: "Ads" | "Free"
  status: GoogleMerchantChannelStatus
}) {
  const meta = CHANNEL_META[status]
  return (
    <Pill tone={meta.tone} title={`${channel === "Ads" ? "Shopping ads" : "Free listings"} (US): ${meta.label}`}>
      <span className="font-normal opacity-70">{channel}</span> {meta.label}
    </Pill>
  )
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

const CHART_TOOLTIP_STYLE = {
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
} as const

// ---------------------------------------------------------------------------
// Merged row type (product + performance)
// ---------------------------------------------------------------------------

type MergedRow = GoogleMerchantProductDetail & {
  clicks: number
  impressions: number
  ctr: number
  conversions: number
  conversionValueUsd: number
}

function shortOffer(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}

function productHref(row: { offerId: string; link: string | null }): string {
  return row.link?.trim() || `/l/${row.offerId}`
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function GoogleMerchantDashboardClient({
  initialInsights,
}: {
  initialInsights: GoogleMerchantInsights
}) {
  const [insights, setInsights] = useState<GoogleMerchantInsights>(initialInsights)
  const [rangeDays, setRangeDays] = useState<number>(initialInsights.rangeDays)
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>(ALL)
  const [issuesOnly, setIssuesOnly] = useState(false)

  const [resyncing, setResyncing] = useState(false)
  const [banner, setBanner] = useState<{ tone: "ok" | "error"; text: string } | null>(null)

  const fetchInsights = useCallback(
    async (days: number) => {
      setLoading(true)
      setBanner(null)
      try {
        const res = await fetch(`/api/admin/google-merchant/insights?days=${days}`, {
          cache: "no-store",
        })
        const json = (await res.json()) as { data?: GoogleMerchantInsights; error?: string }
        if (!res.ok || !json.data) {
          setBanner({ tone: "error", text: json.error || "Failed to load insights." })
          return
        }
        startTransition(() => setInsights(json.data as GoogleMerchantInsights))
      } catch {
        setBanner({ tone: "error", text: "Network error loading insights." })
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  // Keep the data range in sync with the trailing window selector.
  useEffect(() => {
    if (rangeDays !== insights.rangeDays) {
      void fetchInsights(rangeDays)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays])

  const resyncAll = useCallback(async () => {
    setResyncing(true)
    setBanner(null)
    try {
      const res = await fetch("/api/integrations/google-merchant/sync", { method: "POST" })
      const json = (await res.json()) as {
        ok?: boolean
        summary?: {
          inserted: number
          deleted: number
          errors: number
          reconciled_deleted: number
          error_samples?: Array<{ offerId: string; error: string }>
        }
        error?: string
      }
      if (!res.ok || !json.ok) {
        setBanner({ tone: "error", text: json.error || "Resync failed." })
        return
      }
      const s = json.summary
      const errorNote =
        s && s.errors > 0 && s.error_samples?.length
          ? ` First error: ${s.error_samples[0].offerId} — ${s.error_samples[0].error}`
          : ""
      setBanner({
        tone: "ok",
        text: s
          ? `Resync complete — ${s.inserted} upserted, ${s.deleted + s.reconciled_deleted} removed, ${s.errors} errors.${errorNote} Google may take a few minutes to reflect changes in this dashboard.`
          : "Resync complete. Google may take a few minutes to reflect changes in this dashboard.",
      })
      await fetchInsights(rangeDays)
    } catch {
      setBanner({ tone: "error", text: "Network error during resync." })
    } finally {
      setResyncing(false)
    }
  }, [fetchInsights, rangeDays])

  // --- Merge products with performance ---
  const perfByOffer = useMemo(() => {
    const map = new Map<string, GoogleMerchantPerformanceRow>()
    if (insights.performance.configured) {
      for (const row of insights.performance.byOffer) map.set(row.offerId, row)
    }
    return map
  }, [insights.performance])

  const rows = useMemo<MergedRow[]>(() => {
    return insights.products.map((product) => {
      const perf = perfByOffer.get(product.offerId)
      return {
        ...product,
        clicks: perf?.clicks ?? 0,
        impressions: perf?.impressions ?? 0,
        ctr: perf?.ctr ?? 0,
        conversions: perf?.conversions ?? 0,
        conversionValueUsd: perf?.conversionValueUsd ?? 0,
      }
    })
  }, [insights.products, perfByOffer])

  const perfConfigured = insights.performance.configured

  // --- Derived decision lists ("PRO insights") ---
  const decisions = useMemo(() => {
    const disapproved = rows.filter((r) => r.adsStatus === "disapproved")
    const lowCtr = perfConfigured
      ? rows
          .filter((r) => r.impressions >= LOW_CTR_IMPRESSION_FLOOR && r.clicks === 0)
          .sort((a, b) => b.impressions - a.impressions)
      : []
    const notServed = perfConfigured
      ? rows.filter((r) => r.adsStatus === "approved" && r.impressions === 0)
      : []
    const topPerformers = perfConfigured
      ? [...rows].filter((r) => r.clicks > 0).sort((a, b) => b.clicks - a.clicks).slice(0, 8)
      : []
    return { disapproved, lowCtr, notServed, topPerformers }
  }, [rows, perfConfigured])

  // --- Approval status donut ---
  const statusData = useMemo(() => {
    const s = insights.summary
    return (
      [
        { name: "Approved", value: s.approved, fill: STATUS_META.approved.fill },
        { name: "Pending", value: s.pending, fill: STATUS_META.pending.fill },
        { name: "Disapproved", value: s.disapproved, fill: STATUS_META.disapproved.fill },
        { name: "Not targeted", value: s.noDestination, fill: STATUS_META.no_destination.fill },
      ] as const
    ).filter((d) => d.value > 0)
  }, [insights.summary])

  // --- Filtered product table ---
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter((r) => {
        if (statusFilter !== ALL && r.status !== statusFilter) return false
        if (issuesOnly && r.errorCount === 0 && r.warningCount === 0) return false
        if (q) {
          const hay = `${r.title ?? ""} ${r.brand ?? ""} ${r.offerId}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
  }, [rows, search, statusFilter, issuesOnly])

  const filtersActive = search.trim().length > 0 || statusFilter !== ALL || issuesOnly

  const exportCsv = useCallback(() => {
    const header = [
      "offer_id",
      "title",
      "brand",
      "status",
      "ads_status_us",
      "free_listings_status_us",
      "availability",
      "price_usd",
      "error_issues",
      "warning_issues",
      "clicks",
      "impressions",
      "ctr",
      "conversions",
      "conversion_value_usd",
      "link",
    ]
    const lines = [header.join(",")]
    for (const r of rows) {
      lines.push(
        [
          r.offerId,
          r.title ?? "",
          r.brand ?? "",
          r.status,
          r.adsStatus,
          r.freeListingsStatus,
          r.availability ?? "",
          microsToUsd(r.priceMicros) ?? "",
          r.errorCount,
          r.warningCount,
          r.clicks,
          r.impressions,
          r.ctr.toFixed(4),
          r.conversions,
          r.conversionValueUsd.toFixed(2),
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
    a.download = `reswell-merchant-center-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [rows])

  const merchantCenterUrl = insights.account.accountId
    ? `https://merchants.google.com/mc/items/all?a=${insights.account.accountId}`
    : "https://merchants.google.com/"

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
                <ShoppingCart className="h-7 w-7 text-blue-600" />
                Google Merchant Center
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                Pro
              </span>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Ads-first view of Merchant Center: every status, issue, and metric here is scoped to
              what Reswell is actually doing — running Shopping ads in the US to sell surfboards.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                {insights.configured ? (
                  <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-rose-500" />
                )}
                {insights.configured ? "Connected" : "Not connected"}
              </span>
              {insights.account.accountId ? (
                <span className="font-mono">acct {insights.account.accountId}</span>
              ) : null}
              <span>
                feed <span className="font-medium text-foreground">{insights.account.feedLabel}</span> ·{" "}
                {insights.account.contentLanguage}
              </span>
              {insights.account.dataSourceName ? (
                <span className="font-mono" title={insights.account.dataSourceName}>
                  API data source
                </span>
              ) : null}
              <span>
                auth <span className="font-medium text-foreground">{insights.account.authMode}</span>
              </span>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchInsights(rangeDays)}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={resyncAll}
              disabled={resyncing || !insights.configured}
              className="gap-1.5"
            >
              <TrendingUp className={cn("h-4 w-4", resyncing && "animate-pulse")} />
              {resyncing ? "Resyncing…" : "Resync feed"}
            </Button>
            <a
              href={merchantCenterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              <ExternalLink className="h-4 w-4" />
              Open in Google
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
            {banner.tone === "ok" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{banner.text}</span>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="ml-auto rounded p-1 hover:bg-black/5"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      {!insights.configured ? (
        <SetupState reason={insights.reason} />
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Products in feed"
              value={formatNumber(totalProducts)}
              subtitle={`${formatNumber(coverage.syncedEligible)} of ${formatNumber(coverage.eligibleListings)} eligible synced`}
              icon={<Package className="h-5 w-5" />}
              accent="primary"
            />
            <KpiCard
              label="Approved for ads (US)"
              value={formatNumber(summary.adsApproved)}
              subtitle={`${formatPercent(totalProducts > 0 ? summary.adsApproved / totalProducts : 0, 0)} of feed · ${formatNumber(summary.freeListingsApproved)} on free listings`}
              icon={<BadgeCheck className="h-5 w-5" />}
              accent="emerald"
            />
            <KpiCard
              label="Blocked from ads"
              value={formatNumber(summary.adsDisapproved + summary.adsNotTargeted)}
              subtitle={`${formatNumber(summary.adsDisapproved)} disapproved · ${formatNumber(summary.adsNotTargeted)} not targeted · ${formatNumber(summary.pending)} pending`}
              icon={<AlertTriangle className="h-5 w-5" />}
              accent="rose"
            />
            <KpiCard
              label="Ads-blocking issues"
              value={formatNumber(summary.totalErrorIssues)}
              subtitle={`${formatNumber(summary.totalWarningIssues)} warnings (demotions / other channels)`}
              icon={<Filter className="h-5 w-5" />}
              accent="amber"
            />
            <KpiCard
              label="Clicks"
              value={perf.configured ? formatNumber(perf.totals.clicks) : "—"}
              subtitle={perf.configured ? `last ${perf.rangeDays} days` : "performance unavailable"}
              icon={<MousePointerClick className="h-5 w-5" />}
              accent="sky"
            />
            <KpiCard
              label="Impressions"
              value={perf.configured ? formatNumber(perf.totals.impressions) : "—"}
              subtitle={perf.configured ? `last ${perf.rangeDays} days` : "performance unavailable"}
              icon={<Eye className="h-5 w-5" />}
              accent="violet"
            />
            <KpiCard
              label="CTR"
              value={perf.configured ? formatPercent(perf.totals.ctr) : "—"}
              subtitle="clicks ÷ impressions"
              icon={<Gauge className="h-5 w-5" />}
              accent="teal"
            />
            <KpiCard
              label="Conversions"
              value={perf.configured ? formatNumber(perf.totals.conversions) : "—"}
              subtitle={perf.configured ? `${formatUsd(perf.totals.conversionValueUsd, { compact: true })} value` : "performance unavailable"}
              icon={<Target className="h-5 w-5" />}
              accent="primary"
            />
          </div>

          {/* Performance + status */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SectionCard className="lg:col-span-2">
              <SectionHeader
                title="Shopping performance"
                description={`Clicks and impressions per day from Merchant Center (product_performance_view), last ${rangeDays} days.`}
                icon={<LineChartIcon className="h-4 w-4" />}
              />
              {perf.configured && perf.daily.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={perf.daily} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gmcImpr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gmcClicks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateLabel}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      minTickGap={24}
                    />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                    <RechartsTooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelFormatter={(l) => formatDateLabel(String(l))}
                    />
                    <Area
                      type="monotone"
                      dataKey="impressions"
                      name="Impressions"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      fill="url(#gmcImpr)"
                    />
                    <Area
                      type="monotone"
                      dataKey="clicks"
                      name="Clicks"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                      fill="url(#gmcClicks)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>
                  {perf.configured
                    ? "No Shopping performance recorded in this window yet."
                    : perf.reason}
                </EmptyState>
              )}
            </SectionCard>

            <SectionCard>
              <SectionHeader
                title="Shopping ads approval (US)"
                description="Status for the channel you're actually running: Shopping ads in the United States."
                icon={<CheckCircle2 className="h-4 w-4" />}
              />
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
                      <Pie
                        data={statusData as { name: string; value: number; fill: string }[]}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={62}
                        outerRadius={90}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {statusData.map((d) => (
                          <Cell key={d.name} fill={d.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold tabular-nums text-slate-900">
                      {formatNumber(totalProducts)}
                    </span>
                    <span className="text-[11px] uppercase tracking-wide text-slate-500">products</span>
                  </div>
                </div>
              ) : (
                <EmptyState>No products in the feed yet.</EmptyState>
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

          {/* Decisions / opportunities */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DecisionPanel
              title="Disapproved for ads — fix to restore reach"
              description="Products Google won't serve in US Shopping ads. Resolve the issue, then resync."
              icon={<AlertTriangle className="h-4 w-4" />}
              tone="rose"
              rows={decisions.disapproved}
              metric={(r) => `${r.errorCount} ads error${r.errorCount === 1 ? "" : "s"}`}
            />
            <DecisionPanel
              title="Shown but never clicked"
              description={`≥ ${LOW_CTR_IMPRESSION_FLOOR} impressions and 0 clicks — revisit title, image, or price.`}
              icon={<MousePointerClick className="h-4 w-4" />}
              tone="amber"
              rows={decisions.lowCtr}
              metric={(r) => `${formatNumber(r.impressions)} impr · 0 clicks`}
              disabled={!perfConfigured}
            />
            <DecisionPanel
              title="Approved but not getting impressions"
              description="Live in the feed yet invisible — usually price competitiveness or category."
              icon={<Eye className="h-4 w-4" />}
              tone="violet"
              rows={decisions.notServed}
              metric={() => "0 impressions"}
              disabled={!perfConfigured}
            />
            <DecisionPanel
              title="Top performers"
              description="Your best-clicking products — protect inventory and pricing here."
              icon={<TrendingUp className="h-4 w-4" />}
              tone="emerald"
              rows={decisions.topPerformers}
              metric={(r) => `${formatNumber(r.clicks)} clicks · ${formatPercent(r.ctr)}`}
              disabled={!perfConfigured}
            />
          </div>

          {/* Per-product ads optimizations */}
          <OptimizationsPanel optimizations={insights.optimizations} />

          {/* Issues + coverage */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard>
              <SectionHeader
                title="Top item-level issues"
                description="Ads-blocking issues first, then by frequency. Open Google's docs to resolve."
                icon={<AlertTriangle className="h-4 w-4" />}
              />
              {insights.topIssues.length === 0 ? (
                <EmptyState>No item-level issues. Your feed is clean.</EmptyState>
              ) : (
                <ul className="space-y-2">
                  {insights.topIssues.slice(0, 8).map((issue) => {
                    const isError = issue.severity.toUpperCase() === "DISAPPROVED" && issue.affectsAds
                    return (
                      <li
                        key={issue.code}
                        className="flex items-start gap-3 rounded-lg border border-slate-200 p-3"
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                            isError ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600",
                          )}
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-slate-900">{issue.description}</span>
                            <Pill tone={isError ? "rose" : "amber"}>{issue.count}</Pill>
                            {issue.affectsAds ? (
                              <Pill tone="rose" title="Impacts US Shopping ads serving">
                                Blocks ads
                              </Pill>
                            ) : (
                              <Pill tone="slate" title="Does not block US Shopping ads (other channel or country)">
                                Ads OK
                              </Pill>
                            )}
                          </div>
                          <p className="mt-0.5 font-mono text-[11px] text-slate-400">{issue.code}</p>
                        </div>
                        {issue.documentation ? (
                          <a
                            href={issue.documentation}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                          >
                            Fix
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </SectionCard>

            <SectionCard>
              <SectionHeader
                title="Feed coverage"
                description="Eligible Reswell listings vs. what's actually live in Merchant Center."
                icon={<Package className="h-4 w-4" />}
              />
              <div className="space-y-3">
                <ProgressMeter
                  label="Eligible listings synced"
                  value={coverage.syncedEligible}
                  total={coverage.eligibleListings}
                />
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <CoverageStat label="Eligible" value={coverage.eligibleListings} tone="blue" />
                  <CoverageStat label="In feed" value={coverage.productsInMerchant} tone="emerald" />
                  <CoverageStat label="Orphans" value={coverage.orphanOfferIds.length} tone="amber" />
                </div>
              </div>

              {coverage.missingFromMerchant.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Eligible but missing ({coverage.missingFromMerchant.length})
                  </p>
                  <ul className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                    {coverage.missingFromMerchant.slice(0, 25).map((m) => (
                      <li key={m.offerId} className="flex items-center justify-between gap-2 text-sm">
                        <a
                          href={m.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-w-0 items-center gap-1.5 truncate text-slate-700 hover:text-blue-600"
                        >
                          <Link2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{m.title}</span>
                        </a>
                        <span className="shrink-0 tabular-nums text-slate-500">{formatUsd(m.priceUsd)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-slate-500">
                    Run <span className="font-medium text-slate-700">Resync feed</span> to push these to Google.
                  </p>
                </div>
              ) : (
                <p className="mt-4 flex items-center gap-1.5 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Every eligible listing is live in the feed.
                </p>
              )}
            </SectionCard>
          </div>

          {/* Google Analytics */}
          <GoogleAnalyticsPanel analytics={insights.analytics} rangeDays={rangeDays} />

          {/* Product table */}
          <SectionCard className="p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products by title, brand, or offer id…"
                  className="pl-9"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100"
                    aria-label="Clear search"
                  >
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
                    <SelectItem value="disapproved">Disapproved</SelectItem>
                    <SelectItem value="no_destination">Not targeted</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => setIssuesOnly((v) => !v)}
                  className={cn(
                    "h-9 rounded-md border px-3 text-xs font-medium transition-colors",
                    issuesOnly
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50",
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
              <EmptyState>
                {rows.length === 0 ? "No products in the feed yet." : "No products match the filters."}
              </EmptyState>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2 font-medium">Product</th>
                      <th className="px-3 py-2 font-medium">Channels (US)</th>
                      <th className="px-3 py-2 text-right font-medium">Price</th>
                      <th className="px-3 py-2 text-right font-medium">Issues</th>
                      <th className="px-3 py-2 text-right font-medium">Clicks</th>
                      <th className="px-3 py-2 text-right font-medium">Impr.</th>
                      <th className="px-3 py-2 text-right font-medium">CTR</th>
                      <th className="px-3 py-2 text-right font-medium">Conv.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.slice(0, 200).map((r) => (
                      <tr key={r.offerId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                        <td className="px-3 py-2 align-top">
                          <a
                            href={productHref(r)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 text-slate-800 hover:text-blue-600"
                          >
                            {r.imageLink ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={r.imageLink}
                                alt=""
                                loading="lazy"
                                className="h-9 w-9 shrink-0 rounded-md border border-slate-200 object-cover"
                              />
                            ) : (
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-300">
                                <Package className="h-4 w-4" />
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block max-w-[280px] truncate font-medium">
                                {r.title ?? "(untitled)"}
                              </span>
                              <span className="block font-mono text-[11px] text-slate-400">
                                {r.brand ? `${r.brand} · ` : ""}
                                {shortOffer(r.offerId)}
                              </span>
                            </span>
                          </a>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-col items-start gap-1">
                            <ChannelBadge channel="Ads" status={r.adsStatus} />
                            <ChannelBadge channel="Free" status={r.freeListingsStatus} />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right align-top tabular-nums text-slate-700">
                          {formatUsd(microsToUsd(r.priceMicros))}
                        </td>
                        <td className="px-3 py-2 text-right align-top tabular-nums">
                          {r.errorCount > 0 ? (
                            <Pill tone="rose">{r.errorCount}</Pill>
                          ) : r.warningCount > 0 ? (
                            <Pill tone="amber">{r.warningCount}</Pill>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right align-top tabular-nums font-medium text-slate-900">
                          {perfConfigured ? formatNumber(r.clicks) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right align-top tabular-nums text-slate-600">
                          {perfConfigured ? formatNumber(r.impressions) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right align-top tabular-nums text-slate-600">
                          {perfConfigured && r.impressions > 0 ? formatPercent(r.ctr) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right align-top tabular-nums text-slate-600">
                          {perfConfigured ? formatNumber(r.conversions) : "—"}
                        </td>
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
            Live snapshot · Reswell API feed only · generated{" "}
            {new Date(insights.generatedAt).toLocaleString()} · trailing {rangeDays} days · processed
            products can lag product input updates by a few minutes
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

function DecisionPanel({
  title,
  description,
  icon,
  tone,
  rows,
  metric,
  disabled,
}: {
  title: string
  description: string
  icon: ReactNode
  tone: PillTone
  rows: MergedRow[]
  metric: (row: MergedRow) => string
  disabled?: boolean
}) {
  return (
    <SectionCard>
      <SectionHeader title={title} description={description} icon={icon} />
      {disabled ? (
        <EmptyState>Connect Merchant Center performance to see this.</EmptyState>
      ) : rows.length === 0 ? (
        <div className="flex min-h-[100px] items-center justify-center rounded-md border border-dashed border-emerald-200 bg-emerald-50/40 p-4 text-center text-sm text-emerald-700">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Nothing here — all clear.
          </span>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {rows.slice(0, 8).map((r) => (
            <li
              key={r.offerId}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
            >
              <a
                href={productHref(r)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-2 text-slate-700 hover:text-blue-600"
              >
                {r.imageLink ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.imageLink}
                    alt=""
                    loading="lazy"
                    className="h-8 w-8 shrink-0 rounded-md border border-slate-200 object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-300">
                    <Package className="h-3.5 w-3.5" />
                  </span>
                )}
                <span className="truncate text-sm font-medium">{r.title ?? shortOffer(r.offerId)}</span>
              </a>
              <Pill tone={tone}>{metric(r)}</Pill>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

const IMPACT_META: Record<GoogleMerchantOptimizationImpact, { label: string; tone: PillTone }> = {
  high: { label: "High impact", tone: "rose" },
  medium: { label: "Medium", tone: "amber" },
  low: { label: "Low", tone: "slate" },
}

function scoreTone(score: number): string {
  if (score >= 80) return "text-emerald-600"
  if (score >= 55) return "text-amber-600"
  return "text-rose-600"
}

function OptimizationCard({ opt }: { opt: GoogleMerchantProductOptimization }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? opt.tips : opt.tips.slice(0, 2)
  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-start gap-3">
        {opt.imageLink ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={opt.imageLink}
            alt=""
            loading="lazy"
            className="h-10 w-10 shrink-0 rounded-md border border-slate-200 object-cover"
          />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-300">
            <Package className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <a
            href={productHref(opt)}
            target="_blank"
            rel="noopener noreferrer"
            className="block max-w-[320px] truncate text-sm font-medium text-slate-900 hover:text-blue-600"
          >
            {opt.title ?? "(untitled)"}
          </a>
          <p className="mt-0.5 text-xs tabular-nums text-slate-500">
            {formatNumber(opt.impressions)} impr · {formatNumber(opt.clicks)} clicks
            {opt.impressions > 0 ? ` · ${formatPercent(opt.ctr)} CTR` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className={cn("text-lg font-bold tabular-nums", scoreTone(opt.score))}>{opt.score}</span>
          <span className="block text-[10px] uppercase tracking-wide text-slate-400">ad score</span>
        </div>
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {shown.map((tip) => (
          <li key={tip.code} className="flex items-start gap-2 text-xs">
            <Pill tone={IMPACT_META[tip.impact].tone}>{IMPACT_META[tip.impact].label}</Pill>
            <span className="min-w-0 text-slate-600">
              <span className="font-medium text-slate-800">{tip.title}.</span> {tip.detail}
            </span>
          </li>
        ))}
      </ul>
      {opt.tips.length > 2 ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-medium text-blue-600 hover:underline"
        >
          {expanded ? "Show less" : `Show ${opt.tips.length - 2} more`}
        </button>
      ) : null}
    </li>
  )
}

function OptimizationsPanel({
  optimizations,
}: {
  optimizations: GoogleMerchantProductOptimization[]
}) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? optimizations.slice(0, 30) : optimizations.slice(0, 6)
  return (
    <SectionCard>
      <SectionHeader
        title="Ads optimizations"
        description="Per-product opportunities ranked by upside — serving blockers and weak creative first. Fix on the Reswell listing, then resync."
        icon={<Sparkles className="h-4 w-4" />}
        trailing={
          optimizations.length > 6 ? (
            <Button variant="outline" size="sm" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show top 6" : `Show all ${Math.min(optimizations.length, 30)}`}
            </Button>
          ) : null
        }
      />
      {optimizations.length === 0 ? (
        <EmptyState>No optimization opportunities found — your feed is in great shape.</EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {visible.map((opt) => (
            <OptimizationCard key={opt.offerId} opt={opt} />
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

function SetupState({ reason }: { reason?: string }) {
  return (
    <SectionCard>
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <ShoppingCart className="h-7 w-7" />
        </span>
        <div className="max-w-xl space-y-2">
          <h3 className="text-lg font-semibold text-slate-900">Connect Google Merchant Center</h3>
          <p className="text-sm text-slate-500">
            {reason ||
              "The Merchant API isn't configured yet. Once connected, this dashboard shows live approval status, item issues, Shopping clicks and impressions, and feed coverage."}
          </p>
        </div>
        <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-slate-50/60 p-4 text-left">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Required environment
          </p>
          <ul className="space-y-1 font-mono text-[12px] text-slate-600">
            <li>GOOGLE_MERCHANT_ACCOUNT_ID</li>
            <li>GOOGLE_MERCHANT_DATA_SOURCE_NAME</li>
            <li>GCP_* (Workload Identity) or GOOGLE_MERCHANT_SERVICE_ACCOUNT_JSON</li>
          </ul>
        </div>
        <a
          href="https://developers.google.com/merchant/api"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
        >
          Merchant API setup guide
          <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>
    </SectionCard>
  )
}

function GoogleAnalyticsPanel({
  analytics,
  rangeDays,
}: {
  analytics: GoogleMerchantInsights["analytics"]
  rangeDays: number
}) {
  if (!analytics.configured) {
    return (
      <SectionCard>
        <SectionHeader
          title="Google Analytics — on-site traffic"
          description="See how Shopping visitors behave once they land on a product page."
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
            <BarChart3 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800">Connect Google Analytics 4</p>
            <p className="mt-0.5 text-xs text-slate-500">{analytics.reason}</p>
          </div>
          <code className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600">
            GA4_PROPERTY_ID
          </code>
        </div>
      </SectionCard>
    )
  }

  const channelData = analytics.channels.map((c, i) => ({
    name: c.channel,
    value: c.sessions,
    fill: ["#2563eb", "#0ea5e9", "#14b8a6", "#8b5cf6", "#f59e0b", "#ef4444", "#64748b"][i % 7],
  }))

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <SectionCard className="lg:col-span-2">
        <SectionHeader
          title="Google Analytics — product page sessions"
          description={`Daily sessions and views on product pages, last ${rangeDays} days (GA4).`}
          icon={<BarChart3 className="h-4 w-4" />}
          trailing={
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>
                <span className="font-semibold tabular-nums text-slate-900">
                  {formatNumber(analytics.totals.sessions)}
                </span>{" "}
                sessions
              </span>
              <span>
                <span className="font-semibold tabular-nums text-slate-900">
                  {formatNumber(analytics.totals.totalUsers)}
                </span>{" "}
                users
              </span>
              <span>
                <span className="font-semibold tabular-nums text-slate-900">
                  {formatPercent(analytics.totals.engagementRate)}
                </span>{" "}
                engaged
              </span>
            </div>
          }
        />
        {analytics.daily.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={analytics.daily} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateLabel}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                minTickGap={24}
              />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
              <RechartsTooltip contentStyle={CHART_TOOLTIP_STYLE} labelFormatter={(l) => formatDateLabel(String(l))} />
              <Line type="monotone" dataKey="sessions" name="Sessions" stroke="#2563eb" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="views" name="Views" stroke="#14b8a6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState>No GA4 sessions on product pages in this window.</EmptyState>
        )}
      </SectionCard>

      <SectionCard>
        <SectionHeader
          title="Traffic channels"
          description="Where product-page sessions come from."
          icon={<TrendingUp className="h-4 w-4" />}
        />
        {channelData.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(channelData.length * 32 + 8, 120)}>
            <BarChart data={channelData} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#475569" }}
              />
              <RechartsTooltip cursor={{ fill: "rgba(148,163,184,0.12)" }} contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                {channelData.map((d) => (
                  <Cell key={d.name} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState>No channel data.</EmptyState>
        )}
      </SectionCard>

      {analytics.topPages.length > 0 ? (
        <SectionCard className="lg:col-span-3">
          <SectionHeader
            title="Top product pages (GA4)"
            description="Most-viewed product pages and how engaged those visitors are."
            icon={<Eye className="h-4 w-4" />}
          />
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">Page</th>
                  <th className="px-3 py-2 text-right font-medium">Views</th>
                  <th className="px-3 py-2 text-right font-medium">Sessions</th>
                  <th className="px-3 py-2 text-right font-medium">Engagement</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topPages.slice(0, 15).map((p) => (
                  <tr key={p.path} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="px-3 py-2 align-top">
                      <a
                        href={p.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-w-0 items-center gap-1.5 text-slate-700 hover:text-blue-600"
                      >
                        <Link2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{p.title || p.path}</span>
                      </a>
                    </td>
                    <td className="px-3 py-2 text-right align-top tabular-nums font-medium text-slate-900">
                      {formatNumber(p.views)}
                    </td>
                    <td className="px-3 py-2 text-right align-top tabular-nums text-slate-600">
                      {formatNumber(p.sessions)}
                    </td>
                    <td className="px-3 py-2 text-right align-top tabular-nums text-slate-600">
                      {formatPercent(p.engagementRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}
    </div>
  )
}
