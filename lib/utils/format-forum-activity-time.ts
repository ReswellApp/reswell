import { format, formatDistanceToNowStrict } from "date-fns"

/** Compact relative time for forum tables (e.g. 31m, 1h, May 29). */
export function formatForumActivityTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"

  const ms = Date.now() - date.getTime()
  const minutes = Math.floor(ms / 60_000)

  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`

  if (days < 365) return format(date, "MMM d")

  return formatDistanceToNowStrict(date, { addSuffix: false })
}
