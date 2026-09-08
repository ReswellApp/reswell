import type { AdminBusinessInsights, TrendMetric } from '@/lib/types/adminBusinessInsights'
import { formatCompactUsd } from '@/lib/utils/format-compact-usd'
import { cn } from '@/lib/utils'

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

function compactUsd(amount: number): string {
  if (Math.abs(amount) >= 10_000) return formatCompactUsd(amount)
  return formatUsd(amount)
}

function formatPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`
}

function DeltaBadge({ delta }: { delta: TrendMetric }) {
  if (delta.deltaPct === null) {
    return (
      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
        {delta.current > 0 ? 'New' : '—'}
      </span>
    )
  }
  const up = delta.deltaPct >= 0
  const magnitude = Math.abs(delta.deltaPct)
  const text = `${up ? '+' : '−'}${magnitude >= 10 ? magnitude.toFixed(0) : magnitude.toFixed(1)}%`
  return (
    <span
      className={cn(
        'rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
        up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
      )}
    >
      {text}
    </span>
  )
}

interface KpiTileProps {
  label: string
  value: string
  footnote: string
  delta?: TrendMetric
}

function KpiTile({ label, value, footnote, delta }: KpiTileProps) {
  return (
    <div className="admin-surface px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 flex items-end gap-2">
        <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
        {delta ? (
          <span className="mb-0.5">
            <DeltaBadge delta={delta} />
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{footnote}</p>
    </div>
  )
}

interface AdminHomeInsightsKpisProps {
  insights: AdminBusinessInsights
}

export function AdminHomeInsightsKpis({ insights }: AdminHomeInsightsKpisProps) {
  const compare = `vs ${insights.comparePeriodLabel}`
  const take =
    insights.takeRatePct != null ? `${formatPct(insights.takeRatePct)} take` : 'Fees + seller tips'
  const sellThrough =
    insights.supply.sellThroughPct != null
      ? `${formatPct(insights.supply.sellThroughPct, 0)} sell-through`
      : null

  return (
    <section className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {insights.periodLabel}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="GMS"
          value={compactUsd(insights.revenue.gmv.current)}
          delta={insights.revenue.gmv}
          footnote={`${insights.revenue.orders.current} sales · ${compare} · ${compactUsd(insights.revenue.gmv.previous)}`}
        />
        <KpiTile
          label="Platform revenue"
          value={compactUsd(insights.revenue.platformRevenue.current)}
          delta={insights.revenue.platformRevenue}
          footnote={`${take} · ${compare} · ${compactUsd(insights.revenue.platformRevenue.previous)}`}
        />
        <KpiTile
          label="New listings"
          value={String(insights.growth.newListings.current)}
          delta={insights.growth.newListings}
          footnote={
            sellThrough
              ? `${sellThrough} · ${compare} · ${insights.growth.newListings.previous}`
              : `${compare} · ${insights.growth.newListings.previous}`
          }
        />
        <KpiTile
          label="New users"
          value={String(insights.growth.newMembers.current)}
          delta={insights.growth.newMembers}
          footnote={`${compare} · ${insights.growth.newMembers.previous}`}
        />
      </div>
    </section>
  )
}
