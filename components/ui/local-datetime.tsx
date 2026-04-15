"use client"

import { cn } from "@/lib/utils"

export type LocalDateTimeProps = {
  iso: string
  className?: string
  dateStyle?: Intl.DateTimeFormatOptions["dateStyle"]
  timeStyle?: Intl.DateTimeFormatOptions["timeStyle"]
}

/**
 * Formats an ISO timestamp in the viewer's local timezone (browser).
 * Use this instead of server-rendered `Date#toLocaleString` so times match the user's location.
 */
export function LocalDateTime({
  iso,
  className,
  dateStyle = "medium",
  timeStyle = "short",
}: LocalDateTimeProps) {
  const d = new Date(iso)
  const label = Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, { dateStyle, timeStyle })

  return (
    <time dateTime={iso} className={cn("tabular-nums", className)} suppressHydrationWarning>
      {label}
    </time>
  )
}

export type LocalDateOnlyProps = {
  iso: string
  className?: string
  dateStyle?: Intl.DateTimeFormatOptions["dateStyle"]
}

/** Date-only label in the viewer's local calendar day / locale. */
export function LocalDateOnly({
  iso,
  className,
  dateStyle = "medium",
}: LocalDateOnlyProps) {
  const d = new Date(iso)
  const label = Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { dateStyle })

  return (
    <time dateTime={iso} className={cn("tabular-nums", className)} suppressHydrationWarning>
      {label}
    </time>
  )
}
