import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns"

/**
 * Local-calendar thread timestamps ("1:52 PM", "Yesterday 9:04 AM").
 * Must run after mount — server UTC vs the browser timezone otherwise
 * hydrates a different string (React minified error #418).
 */
export function formatLocalThreadTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  if (isToday(date)) return format(date, "h:mm a")
  if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`
  return format(date, "MMM d, h:mm a")
}

/**
 * Compact support-desk clock ("3 min", "12 sec"). Same SSR rule as
 * {@link formatLocalThreadTime}.
 */
export function formatDeskTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return formatDistanceToNowStrict(date)
    .replace(/ minutes?/, " min")
    .replace(/ seconds?/, " sec")
}
