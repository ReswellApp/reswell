import type { BusinessIntelligencePeriodKind } from "@/lib/validations/businessIntelligence"
import {
  addBusinessDays,
  BUSINESS_TIMEZONE,
  BUSINESS_TIMEZONE_LABEL,
  businessDayKeyFromMs,
  businessDayStartMs,
} from "@/lib/utils/business-timezone"

export { BUSINESS_TIMEZONE_LABEL }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const WEEK_RE = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/

export type IntelligencePeriodResolved = {
  kind: BusinessIntelligencePeriodKind
  periodKey: string
  label: string
  compareLabel: string
  startDate: string
  endDate: string
  fromIso: string
  toIsoExclusive: string
  prevStartDate: string
  prevEndDate: string
  prevFromIso: string
  prevToIsoExclusive: string
  periodDays: number
}

function assertDateKey(value: string): string {
  if (!DATE_RE.test(value)) {
    throw new Error(`Invalid Pacific date key: ${value}`)
  }
  return value
}

function weekdayMonday0(dateKey: string): number {
  const anchor = businessDayStartMs(dateKey) + 12 * 60 * 60 * 1000
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "short",
  }).format(new Date(anchor))
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  }
  return map[wd] ?? 0
}

function mondayOfWeek(dateKey: string): string {
  return addBusinessDays(dateKey, -weekdayMonday0(dateKey))
}

/** ISO week number (Mon-start) for a Pacific calendar day. */
export function isoWeekKeyFromDate(dateKey: string): string {
  const monday = mondayOfWeek(dateKey)
  const [y, m, d] = monday.split("-").map(Number)
  const utcThursday = Date.UTC(y, m - 1, d + 3)
  const isoYear = new Date(utcThursday).getUTCFullYear()
  const jan4 = new Date(Date.UTC(isoYear, 0, 4))
  const jan4Monday = mondayOfWeek(
    `${jan4.getUTCFullYear()}-${String(jan4.getUTCMonth() + 1).padStart(2, "0")}-${String(jan4.getUTCDate()).padStart(2, "0")}`,
  )
  const [jy, jm, jd] = jan4Monday.split("-").map(Number)
  const week1Ms = Date.UTC(jy, jm - 1, jd)
  const thisMs = Date.UTC(y, m - 1, d)
  const week = Math.floor((thisMs - week1Ms) / (7 * 24 * 60 * 60 * 1000)) + 1
  return `${isoYear}-W${String(week).padStart(2, "0")}`
}

function datesForIsoWeek(weekKey: string): { startDate: string; endDate: string } {
  const match = WEEK_RE.exec(weekKey)
  if (!match) throw new Error(`Invalid ISO week key: ${weekKey}`)
  const year = Number(weekKey.slice(0, 4))
  const week = Number(weekKey.slice(6))
  const jan4 = `${year}-01-04`
  const week1Monday = mondayOfWeek(jan4)
  const startDate = addBusinessDays(week1Monday, (week - 1) * 7)
  return { startDate, endDate: addBusinessDays(startDate, 6) }
}

function monthStartDate(yearMonth: string): string {
  if (!MONTH_RE.test(yearMonth)) throw new Error(`Invalid month key: ${yearMonth}`)
  return `${yearMonth}-01`
}

function monthEndDate(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number)
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const nextStart = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
  return addBusinessDays(nextStart, -1)
}

function shiftYearMonth(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split("-").map(Number)
  const idx = year * 12 + (month - 1) + delta
  const y = Math.floor(idx / 12)
  const m = (idx % 12) + 1
  return `${y}-${String(m).padStart(2, "0")}`
}

function formatDayLabel(dateKey: string): string {
  const anchor = businessDayStartMs(dateKey) + 12 * 60 * 60 * 1000
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(anchor))
}

function formatMonthLabel(yearMonth: string): string {
  const start = monthStartDate(yearMonth)
  const anchor = businessDayStartMs(start) + 12 * 60 * 60 * 1000
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    month: "long",
    year: "numeric",
  }).format(new Date(anchor))
}

function inclusiveDayCount(startDate: string, endDate: string): number {
  let n = 1
  let key = startDate
  while (key < endDate) {
    key = addBusinessDays(key, 1)
    n += 1
    if (n > 400) break
  }
  return n
}

function rangeIso(startDate: string, endDateInclusive: string): {
  fromIso: string
  toIsoExclusive: string
} {
  return {
    fromIso: new Date(businessDayStartMs(startDate)).toISOString(),
    toIsoExclusive: new Date(businessDayStartMs(addBusinessDays(endDateInclusive, 1))).toISOString(),
  }
}

function buildResolved(
  kind: BusinessIntelligencePeriodKind,
  periodKey: string,
  startDate: string,
  endDate: string,
  prevStartDate: string,
  prevEndDate: string,
  label: string,
  compareLabel: string,
): IntelligencePeriodResolved {
  const current = rangeIso(startDate, endDate)
  const prev = rangeIso(prevStartDate, prevEndDate)
  return {
    kind,
    periodKey,
    label,
    compareLabel,
    startDate,
    endDate,
    fromIso: current.fromIso,
    toIsoExclusive: current.toIsoExclusive,
    prevStartDate,
    prevEndDate,
    prevFromIso: prev.fromIso,
    prevToIsoExclusive: prev.toIsoExclusive,
    periodDays: inclusiveDayCount(startDate, endDate),
  }
}

/**
 * Default completed period as of `nowMs`:
 * daily = yesterday PT, weekly = last complete Mon–Sun, monthly = last complete calendar month.
 */
export function defaultIntelligencePeriodKey(
  kind: BusinessIntelligencePeriodKind,
  nowMs = Date.now(),
): string {
  const today = businessDayKeyFromMs(nowMs)
  const yesterday = addBusinessDays(today, -1)
  if (kind === "daily") return yesterday
  if (kind === "weekly") {
    const thisMonday = mondayOfWeek(today)
    const lastSunday = addBusinessDays(thisMonday, -1)
    return isoWeekKeyFromDate(lastSunday)
  }
  const thisMonth = today.slice(0, 7)
  return shiftYearMonth(thisMonth, -1)
}

export function resolveIntelligencePeriod(
  kind: BusinessIntelligencePeriodKind,
  periodKeyInput?: string | null,
  nowMs = Date.now(),
): IntelligencePeriodResolved {
  const periodKey = periodKeyInput?.trim() || defaultIntelligencePeriodKey(kind, nowMs)

  if (kind === "daily") {
    const endDate = assertDateKey(periodKey)
    const prev = addBusinessDays(endDate, -1)
    return buildResolved(
      kind,
      endDate,
      endDate,
      endDate,
      prev,
      prev,
      formatDayLabel(endDate),
      formatDayLabel(prev),
    )
  }

  if (kind === "weekly") {
    const weekKey = WEEK_RE.test(periodKey) ? periodKey : isoWeekKeyFromDate(assertDateKey(periodKey))
    const { startDate, endDate } = datesForIsoWeek(weekKey)
    const prevEnd = addBusinessDays(startDate, -1)
    const prevStart = mondayOfWeek(prevEnd)
    return buildResolved(
      kind,
      weekKey,
      startDate,
      endDate,
      prevStart,
      prevEnd,
      `Week of ${formatDayLabel(startDate)} – ${formatDayLabel(endDate)}`,
      `Week of ${formatDayLabel(prevStart)} – ${formatDayLabel(prevEnd)}`,
    )
  }

  const yearMonth = MONTH_RE.test(periodKey) ? periodKey : periodKey.slice(0, 7)
  if (!MONTH_RE.test(yearMonth)) {
    throw new Error(`Invalid monthly period key: ${periodKey}`)
  }
  const startDate = monthStartDate(yearMonth)
  const endDate = monthEndDate(yearMonth)
  const prevMonth = shiftYearMonth(yearMonth, -1)
  return buildResolved(
    kind,
    yearMonth,
    startDate,
    endDate,
    monthStartDate(prevMonth),
    monthEndDate(prevMonth),
    formatMonthLabel(yearMonth),
    formatMonthLabel(prevMonth),
  )
}

export function ga4DateFromIso(iso: string): string {
  return iso.slice(0, 10)
}
