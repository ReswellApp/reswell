import { fetchProfileCreatedAtSince } from '@/lib/db/adminHomeSignups'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { shiftYearMonth } from '@/lib/utils/adminInsightsPeriod'
import {
  businessDayKey,
  businessDayKeyFromMs,
  businessDayStartMs,
} from '@/lib/utils/business-timezone'

function monthsInclusive(startYm: string, endYm: string): string[] {
  const months: string[] = []
  let cursor = startYm
  while (cursor <= endYm && months.length < 12) {
    months.push(cursor)
    cursor = shiftYearMonth(cursor, 1)
  }
  return months
}

export type AdminHomeSignupPoint = {
  month: string
  label: string
  count: number
}

function monthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number)
  if (!year || !month) return yearMonth
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export async function loadAdminHomeSignupTrend(): Promise<
  { ok: true; data: AdminHomeSignupPoint[] } | { ok: false; error: string }
> {
  try {
    const db = createServiceRoleClient()
    const now = Date.now()
    const todayKey = businessDayKeyFromMs(now)
    const year = todayKey.slice(0, 4)
    const currentYm = todayKey.slice(0, 7)
    const yearStartIso = new Date(businessDayStartMs(`${year}-01-01`)).toISOString()

    const createdAts = await fetchProfileCreatedAtSince(db, yearStartIso)
    if (createdAts.length === 0) {
      return { ok: true, data: [] }
    }

    const counts = new Map<string, number>()
    for (const createdAt of createdAts) {
      const yearMonth = businessDayKey(createdAt).slice(0, 7)
      counts.set(yearMonth, (counts.get(yearMonth) ?? 0) + 1)
    }

    const firstYm = businessDayKey(createdAts[0]).slice(0, 7)
    const data = monthsInclusive(firstYm, currentYm).map((month) => ({
      month,
      label: monthLabel(month),
      count: counts.get(month) ?? 0,
    }))

    return { ok: true, data }
  } catch {
    return { ok: false, error: 'Could not load the sign-up trend.' }
  }
}
