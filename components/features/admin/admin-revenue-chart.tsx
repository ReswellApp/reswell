'use client'

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
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
import { formatCompactUsd } from '@/lib/utils/format-compact-usd'
import {
  formatBusinessDayKeyLong,
  formatBusinessDayKeyShort,
} from '@/lib/utils/business-timezone'

import type {
  AdminInsightsDailyPoint,
  AdminRevenueMonthlyPoint,
} from '@/lib/types/adminBusinessInsights'
import { AdminRevenueMonthlyBars } from '@/components/features/admin/admin-revenue-monthly-bars'

type Metric = 'gmv' | 'orders'

const GRID_STROKE = '#e2e8f0'
const TICK_FILL = '#64748b'

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0]?.payload as AdminInsightsDailyPoint | undefined
  if (!point) return null
  const dateLabel =
    typeof label === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(label)
      ? formatBusinessDayKeyLong(label)
      : String(label)
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-foreground">{dateLabel}</p>
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
  periodFilter?: ReactNode
  monthly?: AdminRevenueMonthlyPoint[]
  insight?: string | null
}

export function AdminRevenueChart({
  data,
  chartSubtitle,
  totalGmv,
  totalOrders,
  periodFilter,
  monthly = [],
  insight = null,
}: AdminRevenueChartProps) {
  const [metric, setMetric] = useState<Metric>('gmv')
  const [chartReady, setChartReady] = useState(false)
  const chartInstanceId = useId().replace(/:/g, '')
  const gmvFillId = `admin-revenue-gmv-${chartInstanceId}`
  const ordersFillId = `admin-revenue-orders-${chartInstanceId}`

  useEffect(() => {
    const frame = requestAnimationFrame(() => setChartReady(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const points = useMemo(
    () =>
      data.map((d) => ({
        date: d.date,
        gmv: Number(d.gmv) || 0,
        fees: Number(d.fees) || 0,
        orders: Number(d.orders) || 0,
      })),
    [data],
  )
  const useMonthly = monthly.length > 0
  const hasData = useMemo(
    () =>
      useMonthly
        ? monthly.some((d) => d.gmv > 0 || d.orders > 0)
        : points.some((d) => d.gmv > 0 || d.orders > 0),
    [monthly, points, useMonthly],
  )
  const yMax = useMemo(() => {
    if (metric === 'gmv') {
      return Math.max(0, ...points.map((d) => Math.max(d.gmv, d.fees)))
    }
    return Math.max(0, ...points.map((d) => d.orders))
  }, [metric, points])

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-headline text-base font-semibold text-foreground">Revenue trend</h3>
          <p className="text-xs text-muted-foreground">{chartSubtitle}</p>
          {insight ? (
            <p className="mt-1.5 max-w-xl text-sm font-medium text-foreground">{insight}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {periodFilter}
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

      <div className={cn('mt-4 w-full min-w-0', useMonthly ? 'h-[300px]' : 'h-[240px]')}>
        {!hasData ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border">
            <p className="text-sm text-muted-foreground">No sales in this window yet.</p>
          </div>
        ) : !chartReady ? (
          <div className="h-full w-full animate-pulse rounded-lg bg-muted/30" aria-hidden />
        ) : useMonthly ? (
          <AdminRevenueMonthlyBars data={monthly} metric={metric} />
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ComposedChart
              data={points}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id={gmvFillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id={ordersFillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(value: string) =>
                  /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatBusinessDayKeyShort(value) : value
                }
                tickLine={false}
                axisLine={false}
                minTickGap={points.length > 45 ? 40 : 28}
                tick={{ fontSize: 11, fill: TICK_FILL }}
              />
              <YAxis
                type="number"
                domain={[0, yMax > 0 ? yMax * 1.08 : 1]}
                tickFormatter={(value: number) =>
                  metric === 'gmv' ? formatCompactUsd(value) : String(value)
                }
                tickLine={false}
                axisLine={false}
                width={48}
                allowDecimals={metric !== 'orders'}
                tick={{ fontSize: 11, fill: TICK_FILL }}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: GRID_STROKE }} />
              <Area
                type="monotone"
                dataKey={metric === 'gmv' ? 'gmv' : 'orders'}
                stroke={metric === 'gmv' ? '#10b981' : '#0ea5e9'}
                strokeWidth={2}
                fill={`url(#${metric === 'gmv' ? gmvFillId : ordersFillId})`}
                dot={false}
                isAnimationActive={false}
              />
              {metric === 'gmv' ? (
                <Line
                  type="monotone"
                  dataKey="fees"
                  stroke="#0ea5e9"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
