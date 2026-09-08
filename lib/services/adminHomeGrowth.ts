import {
  fetchListingCreatedAtSince,
  fetchProfileCreatedAtSince,
} from '@/lib/db/adminHomeSignups'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  resolveAdminHomeRevenuePeriod,
  type AdminHomeRevenueRange,
} from '@/lib/utils/adminInsightsPeriod'
import {
  buildAdminCountMonthlyPoints,
  buildAdminCountPaceInsight,
  type AdminCountMonthlyPoint,
} from '@/lib/utils/adminRevenueMonthly'
import {
  businessDayKey,
  buildBusinessDayKeysForPeriod,
} from '@/lib/utils/business-timezone'

export type AdminHomeCountPoint = {
  date: string
  count: number
}

export type AdminHomeCountTrend = {
  aggregation: 'day' | 'month'
  periodLabel: string
  points: AdminHomeCountPoint[]
  monthly: AdminCountMonthlyPoint[]
  total: number
  insight: string | null
}

export type AdminHomeGrowthTrends = {
  listings: AdminHomeCountTrend
  users: AdminHomeCountTrend
}

function bucketCounts(
  createdAts: string[],
  periodStartMs: number,
  periodEndMs: number,
  aggregation: 'day' | 'month',
  trimLeadingEmpty: boolean,
): AdminHomeCountPoint[] {
  const dailyKeys = buildBusinessDayKeysForPeriod(periodStartMs, periodEndMs)
  const daily = new Map<string, number>()
  for (const key of dailyKeys) daily.set(key, 0)

  for (const createdAt of createdAts) {
    const ts = new Date(createdAt).getTime()
    if (!Number.isFinite(ts) || ts < periodStartMs || ts >= periodEndMs) continue
    const key = businessDayKey(createdAt)
    if (!daily.has(key)) continue
    daily.set(key, (daily.get(key) ?? 0) + 1)
  }

  if (aggregation === 'day') {
    return dailyKeys.map((date) => ({ date, count: daily.get(date) ?? 0 }))
  }

  const months = new Map<string, number>()
  for (const date of dailyKeys) {
    const yearMonth = date.slice(0, 7)
    months.set(yearMonth, (months.get(yearMonth) ?? 0) + (daily.get(date) ?? 0))
  }

  let yearMonths = Array.from(months.keys()).sort()
  if (trimLeadingEmpty) {
    const first = yearMonths.findIndex((ym) => (months.get(ym) ?? 0) > 0)
    if (first > 0) yearMonths = yearMonths.slice(first)
  }

  return yearMonths.map((date) => ({
    date,
    count: months.get(date) ?? 0,
  }))
}

function toTrend(
  createdAts: string[],
  periodStartMs: number,
  periodEndMs: number,
  periodLabel: string,
  aggregation: 'day' | 'month',
  trimLeadingEmpty: boolean,
  range: AdminHomeRevenueRange,
  noun: string,
): AdminHomeCountTrend {
  const daily = bucketCounts(createdAts, periodStartMs, periodEndMs, 'day', false)
  const monthly =
    aggregation === 'month'
      ? buildAdminCountMonthlyPoints(daily, { trimLeadingEmpty })
      : []
  const points =
    aggregation === 'month'
      ? monthly.map((point) => ({ date: point.yearMonth, count: point.count }))
      : daily
  const total = points.reduce((sum, point) => sum + point.count, 0)
  return {
    aggregation,
    periodLabel,
    points,
    monthly,
    total,
    insight: buildAdminCountPaceInsight({ monthly, total, noun, range }),
  }
}

export async function loadAdminHomeGrowthTrends(options?: {
  yearMonth?: string | null
  range?: AdminHomeRevenueRange
}): Promise<{ ok: true; data: AdminHomeGrowthTrends } | { ok: false; error: string }> {
  try {
    const db = createServiceRoleClient()
    const range = options?.range ?? 'ytd'
    const period = resolveAdminHomeRevenuePeriod(options?.yearMonth, range)
    const sinceIso = new Date(period.periodStartMs).toISOString()
    const aggregation: 'day' | 'month' =
      (range === '90d' || range === 'ytd') && !options?.yearMonth ? 'month' : 'day'
    const trimLeadingEmpty = range === 'ytd' && !options?.yearMonth

    const [listingCreatedAts, profileCreatedAts] = await Promise.all([
      fetchListingCreatedAtSince(db, sinceIso),
      fetchProfileCreatedAtSince(db, sinceIso),
    ])

    return {
      ok: true,
      data: {
        listings: toTrend(
          listingCreatedAts,
          period.periodStartMs,
          period.periodEndMs,
          period.label,
          aggregation,
          trimLeadingEmpty,
          range,
          'listings',
        ),
        users: toTrend(
          profileCreatedAts,
          period.periodStartMs,
          period.periodEndMs,
          period.label,
          aggregation,
          trimLeadingEmpty,
          range,
          'users',
        ),
      },
    }
  } catch {
    return { ok: false, error: 'Could not load listing and sign-up trends.' }
  }
}
