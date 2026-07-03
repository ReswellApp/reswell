"use client"

import type { ReactNode } from "react"
import { useCallback, useState, useTransition } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  ArrowUpRight,
  BarChart3,
  ExternalLink,
  Loader2,
  MousePointerClick,
  RefreshCw,
  TrendingUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { GoogleAnalyticsDashboardResult } from "@/lib/services/googleAnalytics"

const RANGE_OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 28, label: "Last 28 days" },
  { value: 90, label: "Last 90 days" },
] as const

const CHART_TOOLTIP_STYLE = {
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  fontSize: 12,
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("en-US")
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

function formatLinkType(value: string): string {
  return value.replace(/_/g, " ")
}

function SectionCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6", className)}>
      {children}
    </section>
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
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
        </div>
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  )
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">
      {children}
    </div>
  )
}

function SetupPanel({ reason }: { reason: string }) {
  return (
    <SectionCard>
      <SectionHeader
        title="Connect Google Analytics 4"
        description="Add server-side GA4 credentials to load traffic and embed click data here."
        icon={<BarChart3 className="h-4 w-4" />}
      />
      <div className="space-y-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4">
        <p className="text-sm text-slate-600">{reason}</p>
        <div className="flex flex-wrap gap-2">
          <code className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600">
            GA4_PROPERTY_ID
          </code>
          <code className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600">
            NEXT_PUBLIC_GA4_MEASUREMENT_ID
          </code>
        </div>
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

export function GoogleAnalyticsAdminClient({
  initialData,
}: {
  initialData: GoogleAnalyticsDashboardResult
}) {
  const [data, setData] = useState(initialData)
  const [rangeDays, setRangeDays] = useState(
    initialData.configured ? initialData.rangeDays : 28,
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const refresh = useCallback(
    (days: number) => {
      startTransition(async () => {
        setError(null)
        try {
          const res = await fetch(`/api/admin/google-analytics?days=${days}`, {
            credentials: "include",
          })
          const json = (await res.json()) as {
            data?: GoogleAnalyticsDashboardResult
            error?: string
          }
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

  if (!data.configured) {
    return <SetupPanel reason={data.reason} />
  }

  const channelData = data.site.channels.map((c, i) => ({
    name: c.channel,
    value: c.sessions,
    fill: ["#2563eb", "#0ea5e9", "#14b8a6", "#8b5cf6", "#f59e0b", "#ef4444", "#64748b"][i % 7],
  }))

  const embedChartData = data.partnerEmbeds.daily.map((row) => {
    const clickRow = data.partnerEmbeds.clickDaily.find((c) => c.date === row.date)
    return {
      date: row.date,
      sessions: row.sessions,
      views: row.views,
      clicks: clickRow?.clicks ?? 0,
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>
            Property <span className="font-medium text-slate-700">{data.propertyId}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Client tag{" "}
            <span className={data.clientMeasurementConfigured ? "text-emerald-700" : "text-amber-700"}>
              {data.clientMeasurementConfigured ? "configured" : "not set"}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(rangeDays)} onValueChange={onRangeChange}>
            <SelectTrigger className="h-9 w-[160px]">
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => refresh(rangeDays)}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {!data.clientMeasurementConfigured ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Set <code className="text-xs">NEXT_PUBLIC_GA4_MEASUREMENT_ID</code> and redeploy so partner
          embed iframes send page views and click events to GA4.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Site sessions" value={formatNumber(data.site.totals.sessions)} />
        <KpiCard label="Site users" value={formatNumber(data.site.totals.totalUsers)} />
        <KpiCard
          label="Embed sessions"
          value={formatNumber(data.partnerEmbeds.totals.sessions)}
          hint="/embed/listings/*"
        />
        <KpiCard
          label="Embed clicks"
          value={formatNumber(data.partnerEmbeds.totals.clicks)}
          hint="partner_embed_click events"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2">
          <SectionHeader
            title="Site sessions"
            description={`Daily sessions and page views, last ${rangeDays} days.`}
            icon={<BarChart3 className="h-4 w-4" />}
            trailing={
              <span className="text-xs text-slate-500">
                {formatPercent(data.site.totals.engagementRate)} engaged
              </span>
            }
          />
          {data.site.daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.site.daily} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateLabel}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  minTickGap={24}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  allowDecimals={false}
                />
                <RechartsTooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelFormatter={(l) => formatDateLabel(String(l))}
                />
                <Line
                  type="monotone"
                  dataKey="sessions"
                  name="Sessions"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="views"
                  name="Views"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState>No sessions in this window.</EmptyState>
          )}
        </SectionCard>

        <SectionCard>
          <SectionHeader
            title="Traffic channels"
            description="Where site sessions come from."
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
                  tick={{ fontSize: 11, fill: "#64748b" }}
                />
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
      </div>

      <SectionCard>
        <SectionHeader
          title="Partner embeds"
          description={`Iframe traffic and outbound clicks on /embed/listings/*, last ${rangeDays} days.`}
          icon={<MousePointerClick className="h-4 w-4" />}
          trailing={
            <a
              href="/admin/partner-embeds"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
            >
              Manage embeds
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          }
        />

        {embedChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={embedChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateLabel}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                minTickGap={24}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                allowDecimals={false}
              />
              <RechartsTooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelFormatter={(l) => formatDateLabel(String(l))}
              />
              <Line
                type="monotone"
                dataKey="sessions"
                name="Embed sessions"
                stroke="#7c3aed"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="clicks"
                name="Embed clicks"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState>No partner embed traffic in this window.</EmptyState>
        )}

        {data.partnerEmbeds.byEmbed.length > 0 ? (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Embed</th>
                  <th className="pb-2 pr-4 font-medium text-right">Sessions</th>
                  <th className="pb-2 pr-4 font-medium text-right">Views</th>
                  <th className="pb-2 font-medium text-right">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {data.partnerEmbeds.byEmbed.map((row) => (
                  <tr key={row.slug} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-4">
                      <div className="font-medium text-slate-900">{row.slug}</div>
                      <div className="text-xs text-slate-500">{row.path}</div>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-slate-700">
                      {formatNumber(row.sessions)}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-slate-700">
                      {formatNumber(row.views)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-slate-700">
                      {formatNumber(row.clicks)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {data.partnerEmbeds.clicksByLinkType.length > 0 ? (
          <div className="mt-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Clicks by link type
            </p>
            <ul className="grid gap-2 sm:grid-cols-3">
              {data.partnerEmbeds.clicksByLinkType.map((row) => (
                <li
                  key={row.linkType}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="capitalize text-slate-700">{formatLinkType(row.linkType)}</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {formatNumber(row.count)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard>
        <SectionHeader
          title="Top pages"
          description={`Most viewed paths site-wide, last ${rangeDays} days.`}
          icon={<BarChart3 className="h-4 w-4" />}
        />
        {data.site.topPages.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Page</th>
                  <th className="pb-2 pr-4 font-medium text-right">Views</th>
                  <th className="pb-2 font-medium text-right">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {data.site.topPages.map((row) => (
                  <tr key={row.path} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-4">
                      <div className="font-medium text-slate-900">{row.path}</div>
                      {row.title ? <div className="text-xs text-slate-500">{row.title}</div> : null}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-slate-700">
                      {formatNumber(row.views)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-slate-700">
                      {formatNumber(row.sessions)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>No page data.</EmptyState>
        )}
      </SectionCard>
    </div>
  )
}
