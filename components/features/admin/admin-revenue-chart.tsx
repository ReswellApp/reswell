'use client'

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts'

import { cn } from '@/lib/utils'

import type { AdminInsightsDailyPoint } from '@/lib/services/adminBusinessInsights'

type Metric = 'gmv' | 'orders'

function formatCompactUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function safeFormat(date: string, pattern: string): string {
  try {
    return format(parseISO(date), pattern)
  } catch {
    return date
  }
}

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0]?.payload as AdminInsightsDailyPoint | undefined
  if (!point) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-foreground">{safeFormat(String(label), 'EEE, MMM d')}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            GMV
          </span>
          <span className="font-semibold tabular-nums text-foreground">{formatUsd(point.gmv)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            Platform fees
          </span>
          <span className="font-semibold tabular-nums text-foreground">{formatUsd(point.fees)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Orders</span>
          <span className="font-semibold tabular-nums text-foreground">{point.orders}</span>
        </div>
      </div>
    </div>
  )
}

interface AdminRevenueChartProps {
  data: AdminInsightsDailyPoint[]
  chartSubtitle: string
  totalGmv: number
  totalOrders: number
}

export function AdminRevenueChart({
  data,
  chartSubtitle,
  totalGmv,
  totalOrders,
}: AdminRevenueChartProps) {
  const [metric, setMetric] = useState<Metric>('gmv')

  const hasData = useMemo(() => data.some((d) => d.gmv > 0 || d.orders > 0), [data])

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-headline text-base font-semibold text-foreground">Revenue trend</h3>
          <p className="text-xs text-muted-foreground">{chartSubtitle}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">GMV</p>
            <p className="text-lg font-bold tabular-nums text-foreground">{formatCompactUsd(totalGmv)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Orders</p>
            <p className="text-lg font-bold tabular-nums text-foreground">{totalOrders}</p>
          </div>
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
            {(['gmv', 'orders'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                  metric === m
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m === 'gmv' ? 'GMV' : 'Orders'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 h-[240px] w-full">
        {!hasData ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border">
            <p className="text-sm text-muted-foreground">No sales in this window yet.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gmvFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(160 84% 39%)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="hsl(160 84% 39%)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="ordersFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(199 89% 48%)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="hsl(199 89% 48%)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis
                dataKey="date"
                tickFormatter={(value: string) => safeFormat(value, 'MMM d')}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                tickFormatter={(value: number) =>
                  metric === 'gmv' ? formatCompactUsd(value) : String(value)
                }
                tickLine={false}
                axisLine={false}
                width={48}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'hsl(var(--border))' }} />
              {metric === 'gmv' ? (
                <>
                  <Area
                    type="monotone"
                    dataKey="gmv"
                    stroke="hsl(160 84% 39%)"
                    strokeWidth={2}
                    fill="url(#gmvFill)"
                  />
                  <Line
                    type="monotone"
                    dataKey="fees"
                    stroke="hsl(199 89% 48%)"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </>
              ) : (
                <Area
                  type="monotone"
                  dataKey="orders"
                  stroke="hsl(199 89% 48%)"
                  strokeWidth={2}
                  fill="url(#ordersFill)"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
