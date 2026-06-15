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

function shortWindowLabel(windowDays: number): string {
  if (windowDays === 1) return 'Yesterday'
  if (windowDays === 30) return '30-day'
  return `${windowDays}-day`
}

function DeltaBadge({ pct, size = 'md' }: { pct: number | null; size?: 'md' | 'sm' }) {
  const tone = deltaTone(pct)
  const Icon = tone === 'neutral' ? Minus : tone === 'positive' ? TrendingUp : TrendingDown

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full font-semibold tabular-nums',
        size === 'md' && 'px-2 py-1 text-xs',
        size === 'sm' && 'px-1.5 py-0.5 text-[11px]',
        tone === 'neutral' && 'bg-secondary text-muted-foreground',
        tone === 'positive' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        tone === 'negative' && 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      )}
    >
      <Icon className={cn(size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3')} aria-hidden />
      {pct === null ? '—' : deltaText(pct)}
    </span>
  )
}

function TrailingPill({
  comparison,
  format,
}: {
  comparison: MomentumComparison
  format: MomentumFormat
}) {
  const tone = deltaTone(comparison.deltaPct)

  return (
    <div
      className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl border border-border/70 bg-muted/25 px-2 py-2 text-center"
      title={`${comparison.label} · ${formatBaseline(comparison.baselinePerDay, format)} avg`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {comparison.windowDays}d
      </span>
      <span
        className={cn(
          'text-xs font-semibold tabular-nums',
          tone === 'neutral' && 'text-muted-foreground',
          tone === 'positive' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'negative' && 'text-rose-600 dark:text-rose-400',
        )}
      >
        {comparison.deltaPct === null ? '—' : deltaText(comparison.deltaPct)}
      </span>
    </div>
  )
}

function MomentumCard({ metric }: { metric: MomentumMetric }) {
  const theme = METRIC_THEME[metric.key]
  const Icon = theme.icon
  const yesterday = metric.comparisons.find((comparison) => comparison.windowDays === 1)
  const trailing = metric.comparisons.filter((comparison) => comparison.windowDays !== 1)
  const anchor = trailing.find((comparison) => comparison.windowDays === 7) ?? trailing[0]

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:border-foreground/15 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {metric.label}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{metric.description}</p>
        </div>
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            theme.chip,
          )}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Today
          </p>
          <p className="mt-0.5 text-2xl font-bold leading-none tabular-nums tracking-tight text-foreground sm:text-[28px]">
            {formatValue(metric.today, metric.format)}
          </p>
        </div>
        {yesterday ? (
          <div className="flex flex-col items-end gap-1">
            <DeltaBadge pct={yesterday.deltaPct} />
            <span className="text-[11px] text-muted-foreground">vs yesterday</span>
          </div>
        ) : null}
      </div>

      {anchor ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {shortWindowLabel(anchor.windowDays)} baseline ·{' '}
          <span className="tabular-nums">{formatBaseline(anchor.baselinePerDay, metric.format)}</span>
        </p>
      ) : null}

      {trailing.length > 0 ? (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            vs trailing avg
          </p>
          <div className="flex gap-1.5">
            {trailing.map((comparison) => (
              <TrailingPill
                key={comparison.windowDays}
                comparison={comparison}
                format={metric.format}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function AdminMomentumMatrix({ matrix }: { matrix: AdminMomentumMatrix }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-headline text-lg font-semibold text-foreground">Day-over-day momentum</h2>
        <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">
          The last 24 hours of each metric versus trailing daily averages.
          {!matrix.searchesTracked
            ? ' Search volume is unavailable (Elasticsearch not configured).'
            : null}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {matrix.metrics.map((metric) => (
          <MomentumCard key={metric.key} metric={metric} />
        ))}
      </div>
    </section>
  )
}
