import type { AdsManagerDashboard } from "@/lib/types/adsManager"
import { formatAdsConversions, formatAdsCount, formatAdsMoney, formatAdsRatio } from "@/lib/ads/manager/format"

export function AdsKpiRow({ data }: { data: AdsManagerDashboard }) {
  const metrics = data.totals.metrics
  const currency = data.totals.currency
  const winners = data.campaigns.filter((row) => row.verdict === "winner").length
  const losers = data.campaigns.filter((row) => row.verdict === "loser").length
  const spend = data.totals.mixedCurrency ? "Mixed currencies" : formatAdsMoney(metrics?.spend ?? 0, currency)

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Tile label="Spend" value={spend} />
      <Tile label="Clicks" value={metrics ? formatAdsCount(metrics.clicks) : "—"} />
      <Tile label="Conversions" value={metrics ? formatAdsConversions(metrics.conversions) : "—"} />
      <Tile label="CPA" value={formatAdsMoney(metrics?.cpa ?? null, currency)} />
      <Tile label="ROAS" value={formatAdsRatio(metrics?.roas ?? null, "multiple")} />
      <Tile label="Campaigns" value={`${winners} winning · ${losers} weak`} />
    </div>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  )
}
