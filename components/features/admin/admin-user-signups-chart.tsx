'use client'

import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { TrendingDown, TrendingUp } from 'lucide-react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts'

import { cn } from '@/lib/utils'

export interface MonthlySignupPoint {
  month: string
  label: string
  count: number
}

interface AdminUserSignupsChartProps {
  data: MonthlySignupPoint[]
  className?: string
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: value >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value)
}

function safeFormat(month: string, pattern: string): string {
  try {
    return format(parseISO(`${month}-01`), pattern)
  } catch {
    return month
  }
}

function ChartTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0]?.payload as MonthlySignupPoint | undefined
  if (!point) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-foreground">{safeFormat(point.month, 'MMMM yyyy')}</p>
      <div className="flex items-center justify-between gap-6">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-violet-500" />
          New users
        </span>
        <span className="font-semibold tabular-nums text-foreground">{compactNumber(point.count)}</span>
      </div>
    </div>
  )
}

export function AdminUserSignupsChart({ data, className }: AdminUserSignupsChartProps) {
  const { hasData, total, current, previous, momPct } = useMemo(() => {
    const total = data.reduce((sum, d) => sum + d.count, 0)
    const current = data.length > 0 ? data[data.length - 1].count : 0
    const previous = data.length > 1 ? data[data.length - 2].count : 0
    const momPct = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0
    return { hasData: total > 0, total, current, previous, momPct }
  }, [data])

  const trendUp = current >= previous

  return (
    <div className={cn('rounded-2xl border border-border bg-card p-5', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-headline text-base font-semibold text-foreground">Sign-up trend</h3>
          <p className="text-xs text-muted-foreground">
            New users per month over the last {data.length} month{data.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">This month</p>
            <p className="text-lg font-bold tabular-nums text-foreground">{compactNumber(current)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">vs last</p>
            <p
              className={cn(
                'inline-flex items-center gap-1 text-lg font-bold tabular-nums',
                trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
              )}
            >
              {trendUp ? (
                <TrendingUp className="h-4 w-4" aria-hidden />
              ) : (
                <TrendingDown className="h-4 w-4" aria-hidden />
              )}
              {momPct >= 0 ? '+' : ''}
              {Math.round(momPct)}%
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 h-[240px] w-full">
        {!hasData ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border">
            <p className="text-sm text-muted-foreground">No sign-ups in this window yet.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(258 90% 66%)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="hsl(258 90% 66%)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis
                dataKey="month"
                tickFormatter={(value: string) => safeFormat(value, 'MMM')}
                tickLine={false}
                axisLine={false}
                minTickGap={16}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                tickFormatter={(value: number) => compactNumber(value)}
                tickLine={false}
                axisLine={false}
                width={40}
                allowDecimals={false}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'hsl(var(--border))' }} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(258 90% 66%)"
                strokeWidth={2}
                fill="url(#signupFill)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {compactNumber(total)} sign-ups across this window
      </p>
    </div>
  )
}
