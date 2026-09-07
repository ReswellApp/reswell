'use client'

import { useMemo } from 'react'
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
import type { AdminRevenueMonthlyPoint } from '@/lib/types/adminBusinessInsights'

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

function formatDelta(value: number): string {
  const magnitude = Math.abs(value)
  const digits = magnitude >= 10 ? 0 : 1
  return `${value >= 0 ? '+' : '−'}${magnitude.toFixed(digits)}%`
}

function MonthlyTooltip({
  active,
  payload,
  metric,
}: TooltipProps<number, string> & { metric: Metric }) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0]?.payload as
    | (AdminRevenueMonthlyPoint & { actual: number; pace: number | null })
    | undefined
  if (!point) return null
  const delta = metric === 'gmv' ? point.gmvDeltaPct : point.ordersDeltaPct
  const projected = metric === 'gmv' ? point.projectedGmv : point.projectedOrders
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-foreground">{point.label}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-teal-500" />
            {point.isPartial ? 'MTD GMV' : 'GMV'}
          </span>
          <span className="font-semibold tabular-nums text-foreground">{formatUsd(point.gmv)}</span>
        </div>
        {projected != null && metric === 'gmv' ? (
          <div className="flex items-center justify-between gap-6">
            <span className="text-muted-foreground">Month-end pace</span>
            <span className="font-semibold tabular-nums text-foreground">{formatUsd(projected)}</span>
          </div>
        ) : null}
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
        {delta != null && point.compareLabel ? (
          <p className="pt-1 text-muted-foreground">
            {formatDelta(delta)} {point.compareLabel}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function MomChip({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="text-[11px] text-muted-foreground">—</span>
  }
  const good = value >= 0
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
        good
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      )}
    >
      {formatDelta(value)}
    </span>
  )
}

function monthlyDomain(values: number[]): [number, number] {
  const positive = values.filter((value) => Number.isFinite(value) && value > 0)
  if (positive.length === 0) return [0, 1]
  const min = Math.min(...positive)
  const max = Math.max(...positive)
  const span = Math.max(max - min, max * 0.12)
  const yMin = min > max * 0.4 ? Math.max(0, min - span * 0.45) : 0
  return [yMin, max + span * 0.18]
}

interface AdminRevenueMonthlyBarsProps {
  data: AdminRevenueMonthlyPoint[]
  metric: Metric
}

export function AdminRevenueMonthlyBars({ data, metric }: AdminRevenueMonthlyBarsProps) {
  const chartData = useMemo(
    () =>
      data.map((point, index) => {
        const next = data[index + 1]
        const actual = metric === 'gmv' ? point.gmv : point.orders
        const projected = metric === 'gmv' ? point.projectedGmv : point.projectedOrders
        const pace =
          point.isPartial && projected != null
            ? projected
            : next?.isPartial
              ? actual
              : null
        return { ...point, actual, pace }
      }),
    [data, metric],
  )
  const [yMin, yMax] = useMemo(
    () =>
      monthlyDomain(
        chartData.flatMap((point) =>
          [point.actual, point.pace].filter((value): value is number => value != null),
        ),
      ),
    [chartData],
  )
  const showMonthChips = data.length <= 4

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={chartData} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              padding={{ left: 28, right: 28 }}
              minTickGap={16}
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
              content={<MonthlyTooltip metric={metric} />}
              cursor={{ stroke: GRID_STROKE, strokeWidth: 1 }}
            />
            <Line
              type="linear"
              dataKey="pace"
              stroke={metric === 'gmv' ? LINE_GMV : LINE_ORDERS}
              strokeWidth={2}
              strokeDasharray="5 5"
              strokeOpacity={0.7}
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="actual"
              stroke={metric === 'gmv' ? LINE_GMV : LINE_ORDERS}
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {showMonthChips ? (
        <div
          className="mt-2 grid gap-2"
          style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
        >
          {data.map((month) => {
            const projected = metric === 'gmv' ? month.projectedGmv : month.projectedOrders
            return (
              <div key={month.yearMonth} className="text-center">
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {metric === 'gmv' ? formatCompactUsd(month.gmv) : month.orders}
                </p>
                <MomChip value={metric === 'gmv' ? month.gmvDeltaPct : month.ordersDeltaPct} />
                {month.isPartial && projected != null ? (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Pace {metric === 'gmv' ? formatCompactUsd(projected) : Math.round(projected)}
                  </p>
                ) : month.compareLabel ? (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{month.compareLabel}</p>
                ) : (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Baseline</p>
                )}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
