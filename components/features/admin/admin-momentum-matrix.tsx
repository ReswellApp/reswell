import {
  Coins,
  DollarSign,
  Minus,
  Package,
  Search,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type {
  AdminMomentumMatrix,
  MomentumComparison,
  MomentumFormat,
  MomentumMetric,
  MomentumMetricKey,
} from '@/lib/services/adminBusinessInsights'
import { cn } from '@/lib/utils'

const METRIC_ICON: Record<MomentumMetricKey, LucideIcon> = {
  gmv: DollarSign,
  platformRevenue: Coins,
  paidOrders: ShoppingBag,
  newUsers: UserPlus,
  newListings: Package,
  searches: Search,
}

function formatUsd(amount: number): string {
  if (Math.abs(amount) >= 10000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount)
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatValue(value: number, format: MomentumFormat): string {
  if (format === 'usd') return formatUsd(value)
  return new Intl.NumberFormat('en-US').format(Math.round(value))
}

function formatBaseline(value: number, format: MomentumFormat): string {
  if (format === 'usd') return `${formatUsd(value)}/day`
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10
  return `${new Intl.NumberFormat('en-US').format(rounded)}/day`
}

function DeltaPill({ comparison }: { comparison: MomentumComparison }) {
  const pct = comparison.deltaPct
  if (pct === null) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
        <Minus className="h-3 w-3" aria-hidden />
        —
      </span>
    )
  }
  const positive = pct >= 0
  const Icon = positive ? TrendingUp : TrendingDown
  const magnitude = Math.abs(pct)
  const text = `${positive ? '+' : '−'}${magnitude >= 10 ? magnitude.toFixed(0) : magnitude.toFixed(1)}%`
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
        positive
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {text}
    </span>
  )
}

function MetricCell({ metric }: { metric: MomentumMetric }) {
  const Icon = METRIC_ICON[metric.key]
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{metric.label}</p>
        <p className="truncate text-[11px] text-muted-foreground">{metric.description}</p>
      </div>
    </div>
  )
}

function ComparisonCell({
  comparison,
  format,
}: {
  comparison: MomentumComparison
  format: MomentumFormat
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      <DeltaPill comparison={comparison} />
      <span className="text-[11px] tabular-nums text-muted-foreground">
        {formatBaseline(comparison.baselinePerDay, format)}
      </span>
    </div>
  )
}

export function AdminMomentumMatrix({ matrix }: { matrix: AdminMomentumMatrix }) {
  const windows = matrix.metrics[0]?.comparisons.map((c) => c.label) ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline text-base font-semibold">
          Day-over-day momentum
        </CardTitle>
        <CardDescription>
          The last 24 hours of each metric versus its average daily run-rate over trailing windows.
          {!matrix.searchesTracked
            ? ' Search volume is unavailable (Elasticsearch not configured).'
            : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-separate border-spacing-0 text-left">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card pb-3 pr-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Metric
                </th>
                <th className="px-4 pb-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Today
                </th>
                {windows.map((label) => (
                  <th
                    key={label}
                    className="px-4 pb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.metrics.map((metric) => (
                <tr key={metric.key} className="group">
                  <td className="sticky left-0 z-10 border-t border-border bg-card py-3 pr-4 transition-colors group-hover:bg-muted/40">
                    <MetricCell metric={metric} />
                  </td>
                  <td className="border-t border-border px-4 py-3 text-right align-middle transition-colors group-hover:bg-muted/40">
                    <span className="text-base font-bold tabular-nums text-foreground">
                      {formatValue(metric.today, metric.format)}
                    </span>
                  </td>
                  {metric.comparisons.map((comparison) => (
                    <td
                      key={comparison.windowDays}
                      className="border-t border-border px-4 py-3 align-middle transition-colors group-hover:bg-muted/40"
                    >
                      <ComparisonCell comparison={comparison} format={metric.format} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
