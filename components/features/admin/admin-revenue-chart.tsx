'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
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
import { monthlyChartDomain } from '@/lib/utils/adminRevenueMonthly'

type Metric = 'gmv' | 'orders'

const GRID_STROKE = '#e8e8e8'
const TICK_FILL = '#94a3b8'
const LINE_GMV = '#14b8a6'
const LINE_ORDERS = '#38bdf8'

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function ChartTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0]?.payload as
    | (AdminInsightsDailyPoint & { chartGmv: number })
    | undefined
  if (!point) return null
  const dateLabel =
    typeof label === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(label)
      ? formatBusinessDayKeyLong(label)
      : String(label)
  const gmvLabel = 'GMS'
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-foreground">{dateLabel}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-teal-500" />
            {gmvLabel}
          </span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatUsd(point.chartGmv)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            Platform revenue
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
  totalPlatformRevenue?: number
  periodFilter?: ReactNode
  monthly?: AdminRevenueMonthlyPoint[]
  insight?: string | null
  layout?: 'default' | 'hero'
}

export function AdminRevenueChart({
  data,
  chartSubtitle,
  totalGmv,
  totalOrders,
  totalPlatformRevenue,
  periodFilter,
  monthly = [],
  insight = null,
  layout = 'default',
}: AdminRevenueChartProps) {
  const [metric, setMetric] = useState<Metric>('gmv')
  const [chartReady, setChartReady] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setChartReady(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const points = useMemo(
    () =>
      data.map((d) => {
        const gmv = Number(d.gmv) || 0
        return {
          date: d.date,
          gmv,
          chartGmv: gmv,
          fees: Number(d.fees) || 0,
          orders: Number(d.orders) || 0,
        }
      }),
    [data],
  )
  const useMonthly = monthly.length > 0
  const hasData = useMemo(
    () =>
      useMonthly
        ? monthly.some((d) => d.gmv > 0 || d.orders > 0)
        : points.some((d) => d.chartGmv > 0 || d.orders > 0),
    [monthly, points, useMonthly],
  )
  const [yMin, yMax] = useMemo(
    () =>
      monthlyChartDomain(
        points.map((point) => (metric === 'gmv' ? point.chartGmv : point.orders)),
      ),
    [metric, points],
  )

  const displayGmv = totalGmv
  const platformRevenue =
    totalPlatformRevenue ?? points.reduce((sum, point) => sum + point.fees, 0)
  const isHero = layout === 'hero'

  return (
    <div className={cn(isHero ? 'admin-surface p-5' : 'rounded-2xl border border-border bg-card p-5')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-headline text-base font-semibold text-foreground">
            {isHero ? 'GMS' : 'Revenue trend'}
          </h3>
          <p className="text-xs text-muted-foreground">{chartSubtitle}</p>
          {insight ? (
            <p className="mt-1.5 max-w-xl text-sm font-medium text-foreground">{insight}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {periodFilter}
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">GMS</p>
            <p className="text-lg font-bold tabular-nums text-foreground">
              {formatCompactUsd(displayGmv)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Sales</p>
            <p className="text-lg font-bold tabular-nums text-foreground">{totalOrders}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Platform</p>
            <p className="text-lg font-bold tabular-nums text-foreground">
              {formatCompactUsd(platformRevenue)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
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
                  {m === 'gmv' ? 'GMS' : 'Orders'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={cn('mt-4 w-full min-w-0', 'h-[300px]')}>
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
            <LineChart data={points} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(value: string) =>
                  /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatBusinessDayKeyShort(value) : value
                }
                tickLine={false}
                axisLine={false}
                padding={{ left: 28, right: 28 }}
                minTickGap={points.length > 45 ? 40 : 16}
                tick={{ fontSize: 11, fill: TICK_FILL }}
              />
              <YAxis
                type="number"
                domain={[yMin, yMax]}
                tickFormatter={(value: number) =>
                  metric === 'gmv' ? formatCompactUsd(value) : String(Math.round(value))
                }
                tickLine={false}
                axisLine={false}
                width={48}
                allowDecimals={metric !== 'orders'}
                tick={{ fontSize: 11, fill: TICK_FILL }}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: GRID_STROKE, strokeWidth: 1 }}
              />
              <Line
                type="linear"
                dataKey={metric === 'gmv' ? 'chartGmv' : 'orders'}
                stroke={metric === 'gmv' ? LINE_GMV : LINE_ORDERS}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
