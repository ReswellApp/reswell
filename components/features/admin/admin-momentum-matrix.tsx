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

type MetricTheme = {
  icon: LucideIcon
  chip: string
}

const METRIC_THEME: Record<MomentumMetricKey, MetricTheme> = {
  gmv: { icon: DollarSign, chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  platformRevenue: { icon: Coins, chip: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  paidOrders: { icon: ShoppingBag, chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  newUsers: { icon: UserPlus, chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  newListings: { icon: Package, chip: 'bg-teal-500/10 text-teal-600 dark:text-teal-400' },
  searches: { icon: Search, chip: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
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

type DeltaTone = 'neutral' | 'positive' | 'negative'

function deltaTone(pct: number | null): DeltaTone {
  if (pct === null) return 'neutral'
  return pct >= 0 ? 'positive' : 'negative'
}

function deltaText(pct: number): string {
  const positive = pct >= 0
  const magnitude = Math.abs(pct)
  return `${positive ? '+' : '−'}${magnitude >= 10 ? magnitude.toFixed(0) : magnitude.toFixed(1)}%`
}

/** One trailing-window comparison rendered as a compact, scannable column. */
function ComparisonChip({
  comparison,
  format,
}: {
  comparison: MomentumComparison
  format: MomentumFormat
}) {
  const tone = deltaTone(comparison.deltaPct)
  const Icon = tone === 'neutral' ? Minus : tone === 'positive' ? TrendingUp : TrendingDown

  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg bg-muted/40 px-1.5 py-2 text-center">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {comparison.label}
      </span>
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
          tone === 'neutral' && 'bg-secondary text-muted-foreground',
          tone === 'positive' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
          tone === 'negative' && 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
        )}
      >
        <Icon className="h-3 w-3" aria-hidden />
        {comparison.deltaPct === null ? '—' : deltaText(comparison.deltaPct)}
      </span>
      <span className="text-[10px] tabular-nums text-muted-foreground">
        {formatBaseline(comparison.baselinePerDay, format)}
      </span>
    </div>
  )
}

function MomentumTile({ metric }: { metric: MomentumMetric }) {
  const theme = METRIC_THEME[metric.key]
  const Icon = theme.icon
  const yesterday = metric.comparisons[0]
  const headlineTone = deltaTone(yesterday?.deltaPct ?? null)

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:border-foreground/15 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              theme.chip,
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{metric.label}</p>
            <p className="truncate text-[11px] text-muted-foreground">{metric.description}</p>
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Today
          </p>
          <p className="mt-0.5 text-2xl font-bold leading-none tabular-nums tracking-tight text-foreground">
            {formatValue(metric.today, metric.format)}
          </p>
        </div>
        {yesterday ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-semibold tabular-nums',
              headlineTone === 'neutral' && 'bg-secondary text-muted-foreground',
              headlineTone === 'positive' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
              headlineTone === 'negative' && 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
            )}
          >
            {headlineTone === 'neutral' ? (
              <Minus className="h-3.5 w-3.5" aria-hidden />
            ) : headlineTone === 'positive' ? (
              <TrendingUp className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" aria-hidden />
            )}
            {yesterday.deltaPct === null ? '—' : deltaText(yesterday.deltaPct)}
            <span className="font-normal text-muted-foreground">vs yest.</span>
          </span>
        ) : null}
      </div>

      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${metric.comparisons.length}, minmax(0, 1fr))` }}
      >
        {metric.comparisons.map((comparison) => (
          <ComparisonChip key={comparison.windowDays} comparison={comparison} format={metric.format} />
        ))}
      </div>
    </div>
  )
}

export function AdminMomentumMatrix({ matrix }: { matrix: AdminMomentumMatrix }) {
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {matrix.metrics.map((metric) => (
            <MomentumTile key={metric.key} metric={metric} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
