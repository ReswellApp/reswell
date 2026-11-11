const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function formatMessageClock(date: Date): string {
  const hour = date.getHours()
  const minute = String(date.getMinutes()).padStart(2, "0")
  const suffix = hour >= 12 ? "PM" : "AM"
  const hour12 = hour % 12 || 12
  return `${hour12}:${minute} ${suffix}`
}

function monthDay(date: Date): string {
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`
}

function numericDate(date: Date): string {
  const year = String(date.getFullYear()).slice(-2)
  return `${date.getMonth() + 1}/${date.getDate()}/${year}`
}

/**
 * Compact inbox timestamps, matching Messages.app:
 * today → "9:41 AM", yesterday → "Yesterday", this week → weekday, else date.
 */
export function formatInboxTimestamp(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  if (isSameLocalDay(date, now)) return formatMessageClock(date)

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isSameLocalDay(date, yesterday)) return "Yesterday"

  const weekStart = startOfLocalDay(now)
  weekStart.setDate(weekStart.getDate() - 6)
  if (date.getTime() >= weekStart.getTime()) {
    return WEEKDAYS[date.getDay()] ?? ""
  }
  if (date.getFullYear() === now.getFullYear()) {
    return monthDay(date)
  }
  return numericDate(date)
}

/**
 * Centered thread group label: time only today, otherwise day + time.
 */
export function formatThreadGroupTimestamp(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  if (isSameLocalDay(date, now)) return formatMessageClock(date)

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isSameLocalDay(date, yesterday)) return `Yesterday ${formatMessageClock(date)}`
  if (date.getFullYear() === now.getFullYear()) {
    return `${WEEKDAYS_SHORT[date.getDay()]}, ${monthDay(date)}, ${formatMessageClock(date)}`
  }
  return `${monthDay(date)}, ${date.getFullYear()}, ${formatMessageClock(date)}`
}

export function formatMessageTooltipTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return `${WEEKDAYS[date.getDay()]}, ${monthDay(date)} • ${formatMessageClock(date)}`
}
