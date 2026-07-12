/**
 * Marketplace reporting uses Pacific time so admin daily charts match how the
 * team operates (HQ / ops). Vercel runs in UTC — never rely on server local time.
 */
export const BUSINESS_TIMEZONE = 'America/Los_Angeles'

const businessDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** `YYYY-MM-DD` calendar day for an instant in the business timezone. */
export function businessDayKeyFromMs(ms: number): string {
  return businessDayFormatter.format(new Date(ms))
}

/** `YYYY-MM-DD` calendar day for an ISO timestamp in the business timezone. */
export function businessDayKey(iso: string): string {
  return businessDayKeyFromMs(new Date(iso).getTime())
}

/** Earliest millisecond that falls on `dateKey` in the business timezone. */
function businessDayStartMs(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number)
  let lo = Date.UTC(year, month - 1, day - 1, 8, 0, 0)
  let hi = Date.UTC(year, month - 1, day + 1, 8, 0, 0)
  while (hi - lo > 60_000) {
    const mid = Math.floor((lo + hi) / 2)
    if (businessDayKeyFromMs(mid) < dateKey) lo = mid
    else hi = mid
  }
  return hi
}

function addOneBusinessDay(dateKey: string): string {
  return businessDayKeyFromMs(businessDayStartMs(dateKey) + 25 * 60 * 60 * 1000)
}

/** Inclusive range of business-calendar days from `fromMs` through `toMs`. */
export function buildBusinessDayKeys(fromMs: number, toMs: number): string[] {
  const keys: string[] = []
  let key = businessDayKeyFromMs(fromMs)
  const endKey = businessDayKeyFromMs(toMs)
  while (key <= endKey) {
    keys.push(key)
    if (key === endKey) break
    const next = addOneBusinessDay(key)
    if (next <= key) break
    key = next
  }
  return keys
}

/** Short label for chart axes, e.g. "Jul 11". */
export function formatBusinessDayKeyShort(dateKey: string): string {
  const anchor = businessDayStartMs(dateKey) + 12 * 60 * 60 * 1000
  return new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    month: 'short',
    day: 'numeric',
  }).format(new Date(anchor))
}

/** Tooltip label, e.g. "Sat, Jul 11". */
export function formatBusinessDayKeyLong(dateKey: string): string {
  const anchor = businessDayStartMs(dateKey) + 12 * 60 * 60 * 1000
  return new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(anchor))
}

/** Human label for admin chart subtitles. */
export const BUSINESS_TIMEZONE_LABEL = 'Pacific Time'
