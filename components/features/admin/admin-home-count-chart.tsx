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

import type { AdminHomeCountTrend } from '@/lib/services/adminHomeGrowth'
import type { AdminCountMonthlyPoint } from '@/lib/utils/adminRevenueMonthly'
import { monthlyChartDomain } from '@/lib/utils/adminRevenueMonthly'
import { formatBusinessDayKeyLong, formatBusinessDayKeyShort } from '@/lib/utils/business-timezone'
import { cn } from '@/lib/utils'

const GRID_STROKE = '#e8e8e8'
const TICK_FILL = '#94a3b8'

const SERIES_TONES = {
  listings: { stroke: '#14b8a6', swatchClass: 'bg-teal-500' },
  users: { stroke: '#8b5cf6', swatchClass: 'bg-violet-500' },
} as const

function compactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: value >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatMonth(yearMonth: string, pattern: 'short' | 'long'): string {
  const [year, month] = yearMonth.split('-').map(Number)
  if (!year || !month) return yearMonth
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    month: pattern === 'long' ? 'long' : 'short',
    year: pattern === 'long' ? 'numeric' : undefined,
    timeZone: 'UTC',
  })
}

function formatDelta(value: number): string {
  const magnitude = Math.abs(value)
  const digits = magnitude >= 10 ? 0 : 1
  return `${value >= 0 ? '+' : '−'}${magnitude.toFixed(digits)}%`
}

function DailyTooltip({
  active,
  payload,
  seriesLabel,
  swatchClass,
}: TooltipProps<number, string> & { seriesLabel: string; swatchClass: string }) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0]?.payload as { date?: string; count?: number } | undefined
  if (!point?.date) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-foreground">{formatBusinessDayKeyLong(point.date)}</p>
      <div className="flex items-center justify-between gap-6">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className={cn('h-2 w-2 rounded-full', swatchClass)} />
          {seriesLabel}
        </span>
        <span className="font-semibold tabular-nums text-foreground">
          {compactNumber(point.count ?? 0)}
        </span>
      </div>
    </div>
  )
}

function MonthlyTooltip({
  active,
  payload,
  seriesLabel,
  swatchClass,
}: TooltipProps<number, string> & { seriesLabel: string; swatchClass: string }) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0]?.payload as
    | (AdminCountMonthlyPoint & { actual: number; pace: number | null })
    | undefined
  if (!point) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium text-foreground">{point.label}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className={cn('h-2 w-2 rounded-full', swatchClass)} />
            {point.isPartial ? `MTD ${seriesLabel.toLowerCase()}` : seriesLabel}
          </span>
          <span className="font-semibold tabular-nums text-foreground">
            {compactNumber(point.count)}
          </span>
        </div>
        {point.projectedCount != null ? (
          <div className="flex items-center justify-between gap-6">
            <span className="text-muted-foreground">Month-end pace</span>
            <span className="font-semibold tabular-nums text-foreground">
              {compactNumber(Math.round(point.projectedCount))}
            </span>
          </div>
        ) : null}
        {point.countDeltaPct != null && point.compareLabel ? (
          <p className="pt-1 text-muted-foreground">
            {formatDelta(point.countDeltaPct)} {point.compareLabel}
          </p>
        ) : null}
      </div>
    </div>
  )
}

interface AdminHomeCountChartProps {
  title: string
  subtitle: string
  seriesLabel: string
  trend: AdminHomeCountTrend
  tone: keyof typeof SERIES_TONES
  className?: string
}

export function AdminHomeCountChart({
  title,
  subtitle,
  seriesLabel,
  trend,
  tone,
  className,
}: AdminHomeCountChartProps) {
  const series = SERIES_TONES[tone]
  const useMonthly = trend.monthly.length > 0
  const hasData = useMemo(
    () =>
      useMonthly
        ? trend.monthly.some((point) => point.count > 0)
        : trend.points.some((point) => point.count > 0),
    [trend.monthly, trend.points, useMonthly],
  )

  const monthlyData = useMemo(
    () =>
      trend.monthly.map((point, index) => {
        const next = trend.monthly[index + 1]
        const pace =
          point.isPartial && point.projectedCount != null
            ? point.projectedCount
            : next?.isPartial
              ? point.count
              : null
        return { ...point, actual: point.count, pace }
      }),
    [trend.monthly],
  )

  const [yMin, yMax] = useMemo(
    () =>
      monthlyChartDomain(
        monthlyData.flatMap((point) =>
          [point.actual, point.pace].filter((value): value is number => value != null),
        ),
      ),
    [monthlyData],
  )

  return (
    <div className={cn('admin-surface p-5', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-headline text-base font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
          {trend.insight ? (
            <p className="mt-1.5 max-w-xl text-sm font-medium text-foreground">{trend.insight}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{seriesLabel}</p>
          <p className="text-lg font-bold tabular-nums text-foreground">{compactNumber(trend.total)}</p>
        </div>
      </div>
      <div className={cn('mt-4 w-full min-w-0', useMonthly ? 'h-[300px]' : 'h-[240px]')}>
        {!hasData ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              No {seriesLabel.toLowerCase()} in this window yet.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart
              data={useMonthly ? monthlyData : trend.points}
              margin={{ top: 16, right: 24, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis
                dataKey={useMonthly ? 'label' : 'date'}
                tickFormatter={
                  useMonthly
                    ? undefined
                    : (value: string) =>
                        /^\d{4}-\d{2}-\d{2}$/.test(value)
                          ? formatBusinessDayKeyShort(value)
                          : formatMonth(value, 'short')
                }
                tickLine={false}
                axisLine={false}
                padding={{ left: 28, right: 28 }}
                minTickGap={useMonthly ? 16 : trend.points.length > 45 ? 40 : 16}
                tick={{ fontSize: 11, fill: TICK_FILL }}
              />
              <YAxis
                type="number"
                domain={useMonthly ? [yMin, yMax] : [0, 'auto']}
                tickFormatter={(value: number) => compactNumber(value)}
                tickLine={false}
                axisLine={false}
                width={48}
                allowDecimals={false}
                tick={{ fontSize: 11, fill: TICK_FILL }}
              />
              <Tooltip
                content={
                  useMonthly ? (
                    <MonthlyTooltip seriesLabel={seriesLabel} swatchClass={series.swatchClass} />
                  ) : (
                    <DailyTooltip seriesLabel={seriesLabel} swatchClass={series.swatchClass} />
                  )
                }
                cursor={{ stroke: GRID_STROKE, strokeWidth: 1 }}
              />
              {useMonthly ? (
                <Line
                  type="linear"
                  dataKey="pace"
                  stroke={series.stroke}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  strokeOpacity={0.7}
                  dot={false}
                  activeDot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ) : null}
              <Line
                type="linear"
                dataKey={useMonthly ? 'actual' : 'count'}
                stroke={series.stroke}
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
