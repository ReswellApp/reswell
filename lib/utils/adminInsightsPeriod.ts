import { z } from 'zod'

/** Rolling comparison window for the admin overview BI dashboard. */
export const ADMIN_INSIGHTS_PERIOD_DAYS = 30

/** How many calendar months appear in the admin overview month picker. */
export const ADMIN_INSIGHTS_MONTH_PICKER_COUNT = 36

export const adminInsightsYearMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)

export type AdminInsightsPeriodMode = 'rolling' | 'month'

export type AdminInsightsPeriodResolved =
  | {
      mode: 'rolling'
      periodDays: number
      label: string
      compareLabel: string
      periodStartMs: number
      periodEndMs: number
      prevStartMs: number
      prevEndMs: number
      fetchSinceIso: string
    }
  | {
      mode: 'month'
      yearMonth: string
      label: string
      compareLabel: string
      periodDays: number
      periodStartMs: number
      periodEndMs: number
      prevStartMs: number
      prevEndMs: number
      fetchSinceIso: string
    }

function utcMonthStartMs(year: number, monthIndex0: number): number {
  return Date.UTC(year, monthIndex0, 1)
}

function parseYearMonth(yearMonth: string): { year: number; month: number } | null {
  const parsed = adminInsightsYearMonthSchema.safeParse(yearMonth)
  if (!parsed.success) return null
  const [y, m] = parsed.data.split('-')
  return { year: Number(y), month: Number(m) }
}

/** UTC calendar months newest-first, e.g. `2026-06`, `2026-05`, … */
export function utcYearMonthChoices(count: number): string[] {
  const months: string[] = []
  const now = new Date()
  let y = now.getUTCFullYear()
  let mo = now.getUTCMonth() + 1
  for (let i = 0; i < count; i++) {
    months.push(`${y}-${String(mo).padStart(2, '0')}`)
    mo -= 1
    if (mo < 1) {
      mo = 12
      y -= 1
    }
  }
  return months
}

export function formatAdminInsightsMonthLabel(yearMonth: string): string {
  const parts = parseYearMonth(yearMonth)
  if (!parts) return yearMonth
  return new Date(Date.UTC(parts.year, parts.month - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function resolveAdminInsightsPeriod(
  yearMonthInput?: string | null,
): AdminInsightsPeriodResolved {
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000

  if (yearMonthInput) {
    const parts = parseYearMonth(yearMonthInput)
    if (parts) {
      const { year, month } = parts
      const monthIndex0 = month - 1
      const periodStartMs = utcMonthStartMs(year, monthIndex0)
      const monthEndMs = utcMonthStartMs(
        monthIndex0 === 11 ? year + 1 : year,
        monthIndex0 === 11 ? 0 : monthIndex0 + 1,
      )
      const periodEndMs = Math.min(now, monthEndMs)
      const daysInMonth = Math.max(
        1,
        Math.round((monthEndMs - periodStartMs) / dayMs),
      )

      let prevYear = year
      let prevMonthIndex0 = monthIndex0 - 1
      if (prevMonthIndex0 < 0) {
        prevMonthIndex0 = 11
        prevYear -= 1
      }
      const prevStartMs = utcMonthStartMs(prevYear, prevMonthIndex0)
      const prevEndMs = utcMonthStartMs(year, monthIndex0)

      const ym = `${year}-${String(month).padStart(2, '0')}`
      const prevYm = `${prevYear}-${String(prevMonthIndex0 + 1).padStart(2, '0')}`

      return {
        mode: 'month',
        yearMonth: ym,
        label: formatAdminInsightsMonthLabel(ym),
        compareLabel: formatAdminInsightsMonthLabel(prevYm),
        periodDays: daysInMonth,
        periodStartMs,
        periodEndMs,
        prevStartMs,
        prevEndMs,
        fetchSinceIso: new Date(prevStartMs).toISOString(),
      }
    }
  }

  const periodMs = ADMIN_INSIGHTS_PERIOD_DAYS * dayMs
  const periodStartMs = now - periodMs
  return {
    mode: 'rolling',
    periodDays: ADMIN_INSIGHTS_PERIOD_DAYS,
    label: `Last ${ADMIN_INSIGHTS_PERIOD_DAYS} days`,
    compareLabel: `prior ${ADMIN_INSIGHTS_PERIOD_DAYS} days`,
    periodStartMs,
    periodEndMs: now,
    prevStartMs: now - 2 * periodMs,
    prevEndMs: periodStartMs,
    fetchSinceIso: new Date(now - 2 * periodMs).toISOString(),
  }
}

export function utcMonthStartIso(yearMonth: string): string | null {
  const parts = parseYearMonth(yearMonth)
  if (!parts) return null
  return new Date(utcMonthStartMs(parts.year, parts.month - 1)).toISOString()
}
