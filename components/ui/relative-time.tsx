"use client"

import { useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

/**
 * Relative labels ("3 hours ago", "Sold today") must not be computed during SSR.
 * Server clock / timezone vs the browser otherwise produces a text-node mismatch
 * (React minified error #418).
 */
export function RelativeTime({
  iso,
  formatLabel,
  className,
  placeholder = "",
}: {
  iso: string
  formatLabel: (iso: string) => string
  className?: string
  placeholder?: string
}) {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    setLabel(formatLabel(iso))
  }, [formatLabel, iso])

  return (
    <time dateTime={iso} className={cn("tabular-nums", className)}>
      {label ?? placeholder}
    </time>
  )
}

export function formatDistanceToNowLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return formatDistanceToNow(date, { addSuffix: true })
}
