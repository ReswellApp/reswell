import type {
  AdminInsightsDailyPoint,
  AdminRevenueMonthlyPoint,
} from '@/lib/types/adminBusinessInsights'
import { formatMonthKey } from '@/lib/pnl-calc'
import { formatCompactUsd } from '@/lib/utils/format-compact-usd'
import { shiftYearMonth, type AdminHomeRevenueRange } from '@/lib/utils/adminInsightsPeriod'
import {
  addBusinessDays,
  businessDayKeyFromMs,
  businessDayStartMs,
  buildBusinessDayKeys,
} from '@/lib/utils/business-timezone'

function deltaPct(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return ((current - previous) / previous) * 100
}

function monthShort(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number)
  if (!year || !month) return yearMonth
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  })
}

function daysInYearMonth(yearMonth: string): number {
  const nextStart = `${shiftYearMonth(yearMonth, 1)}-01`
  const lastDay = addBusinessDays(nextStart, -1)
  return Number(lastDay.slice(8, 10))
}

export type AdminCountMonthlyPoint = {
  yearMonth: string
  label: string
  count: number
  countDeltaPct: number | null
  isPartial: boolean
  compareLabel: string | null
  projectedCount: number | null
}

export function monthlyChartDomain(values: number[]): [number, number] {
  const positive = values.filter((value) => Number.isFinite(value) && value > 0)
  if (positive.length === 0) return [0, 1]
  const min = Math.min(...positive)
  const max = Math.max(...positive)
  const span = Math.max(max - min, max * 0.12)
  const yMin = min > max * 0.4 ? Math.max(0, min - span * 0.45) : 0
  return [yMin, max + span * 0.18]
}

export function buildAdminCountMonthlyPoints(
  daily: { date: string; count: number }[],
  options?: { nowMs?: number; trimLeadingEmpty?: boolean },
): AdminCountMonthlyPoint[] {
  const nowMs = options?.nowMs ?? Date.now()
  const todayKey = businessDayKeyFromMs(nowMs)
  const currentYm = todayKey.slice(0, 7)
  const currentDay = Number(todayKey.slice(8, 10))

  const buckets = new Map<string, { count: number; mtdCount: number }>()
  for (const point of daily) {
    const yearMonth = point.date.slice(0, 7)
    const bucket = buckets.get(yearMonth) ?? { count: 0, mtdCount: 0 }
    bucket.count += point.count
    if (Number(point.date.slice(8, 10)) <= currentDay) {
      bucket.mtdCount += point.count
    }
    buckets.set(yearMonth, bucket)
  }

  let yearMonths = Array.from(buckets.keys()).sort()
  if (options?.trimLeadingEmpty) {
    const first = yearMonths.findIndex((ym) => (buckets.get(ym)?.count ?? 0) > 0)
    if (first > 0) yearMonths = yearMonths.slice(first)
  }

  return yearMonths.map((yearMonth, index) => {
    const bucket = buckets.get(yearMonth)
    const previous = index > 0 ? buckets.get(yearMonths[index - 1]) : undefined
    const isPartial = yearMonth === currentYm
    const count = bucket?.count ?? 0
    const compare = isPartial ? previous?.mtdCount : previous?.count
    const previousYm = index > 0 ? yearMonths[index - 1] : null
    const monthDays = daysInYearMonth(yearMonth)
    const projectedCount =
      isPartial && currentDay > 0 ? (count / currentDay) * monthDays : null

    return {
      yearMonth,
      label: isPartial ? `${monthShort(yearMonth)} (MTD)` : monthShort(yearMonth),
      count,
      countDeltaPct: compare == null ? null : deltaPct(count, compare),
      isPartial,
      compareLabel: previousYm
        ? isPartial
          ? `vs ${monthShort(previousYm)} 1–${currentDay}`
          : `vs ${formatMonthKey(previousYm)}`
        : null,
      projectedCount,
    }
  })
}

export function buildAdminCountPaceInsight(input: {
  monthly: AdminCountMonthlyPoint[]
  total: number
  noun: string
  range: AdminHomeRevenueRange
  nowMs?: number
}): string | null {
  const { monthly, total, noun, range } = input
  if (monthly.length === 0 || total <= 0) return null
  const nowMs = input.nowMs ?? Date.now()
  const current = monthly[monthly.length - 1]

  if (range === 'ytd') {
    const todayKey = businessDayKeyFromMs(nowMs)
    const year = todayKey.slice(0, 4)
    const yearStart = businessDayStartMs(`${year}-01-01`)
    const dayOfYear = buildBusinessDayKeys(yearStart, nowMs).length
    const daysInYear = buildBusinessDayKeys(yearStart, businessDayStartMs(`${year}-12-31`)).length
    if (dayOfYear <= 0) return null
    const yearEndPace = Math.round((total / dayOfYear) * daysInYear)
    return `YTD ${total.toLocaleString('en-US')} ${noun} · on pace for ${yearEndPace.toLocaleString('en-US')} in ${year}.`
  }

  if (range === '90d' && current?.isPartial && current.projectedCount != null) {
    return `${monthShort(current.yearMonth)} is on pace for ${Math.round(current.projectedCount).toLocaleString('en-US')} ${noun} if this month holds.`
  }

  return null
}

export function buildAdminRevenueMonthlyPoints(
  daily: AdminInsightsDailyPoint[],
  options?: { nowMs?: number; trimLeadingEmpty?: boolean },
): AdminRevenueMonthlyPoint[] {
  const nowMs = options?.nowMs ?? Date.now()
  const todayKey = businessDayKeyFromMs(nowMs)
  const currentYm = todayKey.slice(0, 7)
  const currentDay = Number(todayKey.slice(8, 10))

  const buckets = new Map<
    string,
    {
      gmv: number
      fees: number
      orders: number
      mtdGmv: number
      mtdOrders: number
    }
  >()

  for (const point of daily) {
    const yearMonth = point.date.slice(0, 7)
    const bucket = buckets.get(yearMonth) ?? {
      gmv: 0,
      fees: 0,
      orders: 0,
      mtdGmv: 0,
      mtdOrders: 0,
    }
    bucket.gmv += point.gmv
    bucket.fees += point.fees
    bucket.orders += point.orders
    if (Number(point.date.slice(8, 10)) <= currentDay) {
      bucket.mtdGmv += point.gmv
      bucket.mtdOrders += point.orders
    }
    buckets.set(yearMonth, bucket)
  }

  let yearMonths = Array.from(buckets.keys()).sort()
  if (options?.trimLeadingEmpty) {
    const firstRevenue = yearMonths.findIndex((ym) => {
      const bucket = buckets.get(ym)
      return (bucket?.gmv ?? 0) > 0 || (bucket?.orders ?? 0) > 0
    })
    if (firstRevenue > 0) yearMonths = yearMonths.slice(firstRevenue)
  }

  return yearMonths.map((yearMonth, index) => {
    const bucket = buckets.get(yearMonth)
    const previous = index > 0 ? buckets.get(yearMonths[index - 1]) : undefined
    const isPartial = yearMonth === currentYm
    const compareGmv = isPartial ? previous?.mtdGmv : previous?.gmv
    const compareOrders = isPartial ? previous?.mtdOrders : previous?.orders
    const previousYm = index > 0 ? yearMonths[index - 1] : null
    const gmv = bucket?.gmv ?? 0
    const orders = bucket?.orders ?? 0
    const monthDays = daysInYearMonth(yearMonth)
    const projectedGmv =
      isPartial && currentDay > 0 ? (gmv / currentDay) * monthDays : null
    const projectedOrders =
      isPartial && currentDay > 0 ? (orders / currentDay) * monthDays : null

    return {
      yearMonth,
      label: isPartial ? `${monthShort(yearMonth)} (MTD)` : monthShort(yearMonth),
      gmv,
      fees: bucket?.fees ?? 0,
      orders,
      gmvDeltaPct: compareGmv == null ? null : deltaPct(gmv, compareGmv),
      ordersDeltaPct: compareOrders == null ? null : deltaPct(orders, compareOrders),
      isPartial,
      compareLabel: previousYm
        ? isPartial
          ? `vs ${monthShort(previousYm)} 1–${currentDay}`
          : `vs ${formatMonthKey(previousYm)}`
        : null,
      projectedGmv,
      projectedOrders,
    }
  })
}

export function buildAdminRevenuePaceInsight(input: {
  monthly: AdminRevenueMonthlyPoint[]
  totalGmv: number
  range: AdminHomeRevenueRange
  nowMs?: number
}): string | null {
  const { monthly, totalGmv, range } = input
  if (monthly.length === 0) return null
  const nowMs = input.nowMs ?? Date.now()
  const current = monthly[monthly.length - 1]
  const complete = monthly.filter((m) => !m.isPartial)
  const best = complete.reduce<AdminRevenueMonthlyPoint | null>((top, row) => {
    if (!top || row.gmv > top.gmv) return row
    return top
  }, null)

  if (range === 'ytd') {
    const todayKey = businessDayKeyFromMs(nowMs)
    const year = todayKey.slice(0, 4)
    const yearStart = businessDayStartMs(`${year}-01-01`)
    const dayOfYear = buildBusinessDayKeys(yearStart, nowMs).length
    const daysInYear = buildBusinessDayKeys(yearStart, businessDayStartMs(`${year}-12-31`)).length
    if (dayOfYear <= 0 || totalGmv <= 0) return null
    const yearEndPace = (totalGmv / dayOfYear) * daysInYear
    return `YTD ${formatCompactUsd(totalGmv)} since first sale this year · on pace for ${formatCompactUsd(yearEndPace)} in ${year}.`
  }

  if (range === '90d' && current?.isPartial && current.projectedGmv != null) {
    const pace = formatCompactUsd(current.projectedGmv)
    if (best && best.gmv > 0) {
      return `${monthShort(current.yearMonth)} is on pace for ${pace} · ${monthShort(best.yearMonth)} is the bar to beat at ${formatCompactUsd(best.gmv)}.`
    }
    return `${monthShort(current.yearMonth)} is on pace for ${pace} if this month holds its current rate.`
  }

  return null
}
