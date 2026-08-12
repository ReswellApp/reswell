"use client"

import { useCallback, useMemo, useState, useTransition } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Loader2, Megaphone, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdSalesListingsTable, AdSalesOrdersTable } from "@/components/features/admin/ad-sales-tables"
import type { AdSalesChannel, AdSalesDashboardResult } from "@/lib/services/adAttributedSales"

const RANGE_OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 28, label: "Last 28 days" },
  { value: 90, label: "Last 90 days" },
] as const

const CHART_TOOLTIP_STYLE = {
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
} as const

type ChannelFilter = "all" | AdSalesChannel
type SourceFilter = "first_party" | "ga4"

function formatUsd(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  })
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("en-US")
}

function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function AdSalesAdminClient({ initialData }: { initialData: AdSalesDashboardResult }) {
  const [data, setData] = useState(initialData)
  const [days, setDays] = useState(28)
  const [channel, setChannel] = useState<ChannelFilter>("all")
  const [source, setSource] = useState<SourceFilter>("first_party")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const load = useCallback((nextDays: number) => {
    startTransition(async () => {
      setError(null)
      try {
        const res = await fetch(`/api/admin/ad-sales?days=${nextDays}`, {
          credentials: "include",
          cache: "no-store",
        })
        const json = (await res.json()) as { data?: AdSalesDashboardResult; error?: string }
        if (!res.ok || !json.data) {
          setError(json.error || "Could not load ad sales")
          return
        }
        setData(json.data)
      } catch {
        setError("Could not load ad sales")
      }
    })
  }, [])

  const listings = useMemo(() => {
    if (!data.configured) return []
    return data.listings.filter((row) => {
      if (row.dataSource !== source) return false
      if (channel === "all") return row.channel === "google_ads" || row.channel === "meta_ads"
      return row.channel === channel
    })
  }, [data, channel, source])

  const orders = useMemo(() => {
    if (!data.configured) return []
    return data.orders.filter((row) => {
      if (row.dataSource !== source) return false
      if (channel === "all") return row.channel === "google_ads" || row.channel === "meta_ads"
      return row.channel === channel
    })
  }, [data, channel, source])

  if (!data.configured) {
    return (
      <div className="space-y-4 rounded-xl border border-dashed border-border bg-muted/40 p-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Megaphone className="h-4 w-4" />
          Connect Google Analytics 4
        </div>
        <p className="text-sm text-muted-foreground">{data.reason}</p>
        <p className="text-sm text-muted-foreground">
          This page reads GA4 purchase items (listing IDs) by session source/medium. It uses the same
          GA4 credentials as Google Analytics admin.
        </p>
      </div>
    )
  }

  const google = source === "first_party" ? data.totals.google_ads : data.ga4Totals.google_ads
  const metaAds = source === "first_party" ? data.totals.meta_ads : data.ga4Totals.meta_ads
  const metaRef = source === "first_party" ? data.totals.meta_referral : data.ga4Totals.meta_referral

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={String(days)}
          onValueChange={(value) => {
            const next = Number(value)
            setDays(next)
            load(next)
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={String(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={() => load(days)} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
        <p className="text-xs text-muted-foreground">
          {data.startDate} → {data.endDate}
          {data.propertyId ? ` · GA4 ${data.propertyId}` : ""}
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Google Ads"
          value={formatUsd(google.revenue)}
          hint={`${formatNumber(google.itemsPurchased)} items · ${formatNumber(google.listings)} listings`}
        />
        <StatTile
          label="Meta Ads"
          value={formatUsd(metaAds.revenue)}
          hint={`${formatNumber(metaAds.itemsPurchased)} items · ${formatNumber(metaAds.listings)} listings`}
        />
        <StatTile
          label="Meta referral"
          value={formatUsd(metaRef.revenue)}
          hint="Facebook/Instagram without a paid UTM"
        />
        <StatTile
          label="Orders"
          value={formatNumber(google.orders + metaAds.orders)}
          hint={source === "first_party" ? "Click IDs stored on the order" : "GA4 transaction IDs matched to orders"}
        />
      </div>

      {data.insights.length > 0 ? (
        <ul className="space-y-1.5 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {data.insights.map((insight) => (
            <li key={insight}>{insight}</li>
          ))}
        </ul>
      ) : null}

      {data.daily.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">Attributed item revenue</p>
          <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.daily} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v: number) => `$${Math.round(v)}`} tick={{ fontSize: 11 }} width={48} />
              <RechartsTooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(value, name) => [
                  formatUsd(Number(value) || 0),
                  name === "googleAdsRevenue"
                    ? "Google Ads"
                    : name === "metaAdsRevenue"
                      ? "Meta Ads"
                      : "Meta referral",
                ]}
                labelFormatter={(label) => formatDateLabel(String(label))}
              />
              <Area type="monotone" dataKey="googleAdsRevenue" stroke="#2563eb" fill="#2563eb33" />
              <Area type="monotone" dataKey="metaAdsRevenue" stroke="#4f46e5" fill="#4f46e533" />
              <Area type="monotone" dataKey="metaReferralRevenue" stroke="#94a3b8" fill="#94a3b833" />
            </AreaChart>
          </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
        <p className="font-medium text-foreground">Meta traffic ads (non-catalog)</p>
        <p className="mt-1 text-muted-foreground">
          Catalog/DPA links already include UTMs. For traffic or boost ads, paste this into Ads Manager → Ad →
          Website URL parameters:
        </p>
        <code className="mt-2 block overflow-x-auto rounded-md bg-muted px-2 py-1.5 text-xs">
          {data.metaAdsManagerParams}
        </code>
      </div>

      <Tabs value={source} onValueChange={(value) => setSource(value as SourceFilter)}>
        <TabsList>
          <TabsTrigger value="first_party">Click IDs</TabsTrigger>
          <TabsTrigger value="ga4">GA4 modeled</TabsTrigger>
        </TabsList>
      </Tabs>

      <Tabs value={channel} onValueChange={(value) => setChannel(value as ChannelFilter)}>
        <TabsList>
          <TabsTrigger value="all">Paid ads</TabsTrigger>
          <TabsTrigger value="google_ads">Google Ads</TabsTrigger>
          <TabsTrigger value="meta_ads">Meta Ads</TabsTrigger>
          <TabsTrigger value="meta_referral">Meta referral</TabsTrigger>
        </TabsList>
      </Tabs>

      <AdSalesListingsTable rows={listings} />
      <AdSalesOrdersTable rows={orders} />
    </div>
  )
}
