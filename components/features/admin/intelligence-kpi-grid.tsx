import type { ComponentType } from "react"
import {
  DollarSign,
  Megaphone,
  Package,
  Receipt,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  UserPlus,
} from "lucide-react"

import type { AdminBusinessInsights, TrendMetric } from "@/lib/types/adminBusinessInsights"
import { compactUsd, formatCount, formatPct } from "@/components/features/admin/intelligence-format"
import { cn } from "@/lib/utils"

function DeltaBadge({ delta, invert }: { delta: TrendMetric; invert?: boolean }) {
  if (delta.deltaPct === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
        {delta.current > 0 ? "New" : "—"}
      </span>
    )
  }
  const positive = invert ? delta.deltaPct <= 0 : delta.deltaPct >= 0
  const Icon = delta.deltaPct >= 0 ? TrendingUp : TrendingDown
  const mag = Math.abs(delta.deltaPct)
  const text = `${delta.deltaPct >= 0 ? "+" : "−"}${mag >= 10 ? mag.toFixed(0) : mag.toFixed(1)}%`
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
        positive
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {text}
    </span>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  footnote,
  invertDelta,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
  delta: TrendMetric
  footnote: string
  invertDelta?: boolean
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      </div>
      <p className="mt-3 font-headline text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <DeltaBadge delta={delta} invert={invertDelta} />
        <span className="text-[11px] text-muted-foreground">{footnote}</span>
      </div>
    </div>
  )
}

export function IntelligenceKpiGrid({ insights }: { insights: AdminBusinessInsights }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <KpiCard
        icon={DollarSign}
        label="GMV with shipping"
        value={compactUsd(insights.revenue.gmv.current)}
        delta={insights.revenue.gmv}
        footnote={`vs ${insights.comparePeriodLabel}`}
      />
      <KpiCard
        icon={DollarSign}
        label="GMV without shipping"
        value={compactUsd(insights.revenue.gmvWithoutShipping.current)}
        delta={insights.revenue.gmvWithoutShipping}
        footnote={`vs ${insights.comparePeriodLabel}`}
      />
      <KpiCard
        icon={Receipt}
        label="Platform revenue"
        value={compactUsd(insights.revenue.platformRevenue.current)}
        delta={insights.revenue.platformRevenue}
        footnote={
          insights.takeRatePct == null
            ? "7% marketplace take"
            : `${formatPct(insights.takeRatePct)} marketplace take`
        }
      />
      <KpiCard
        icon={Megaphone}
        label="Promo (marketing)"
        value={compactUsd(insights.revenue.marketingExpense.current)}
        delta={insights.revenue.marketingExpense}
        invertDelta
        footnote="Reswell-funded discounts"
      />
      <KpiCard
        icon={ShoppingBag}
        label="Orders"
        value={formatCount(insights.revenue.orders.current)}
        delta={insights.revenue.orders}
        footnote={`AOV ${compactUsd(insights.revenue.aov.current)}`}
      />
      <KpiCard
        icon={UserPlus}
        label="New users"
        value={formatCount(insights.growth.newMembers.current)}
        delta={insights.growth.newMembers}
        footnote={insights.periodLabel}
      />
      <KpiCard
        icon={Package}
        label="New listings"
        value={formatCount(insights.growth.newListings.current)}
        delta={insights.growth.newListings}
        footnote={`${formatCount(insights.supply.activeListings)} active`}
      />
      <KpiCard
        icon={TrendingUp}
        label="Sell-through"
        value={
          insights.supply.sellThroughPct == null ? "—" : formatPct(insights.supply.sellThroughPct)
        }
        delta={insights.revenue.orders}
        footnote={`${formatCount(insights.supply.soldInPeriod)} sold in period`}
      />
    </div>
  )
}
