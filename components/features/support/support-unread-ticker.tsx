"use client"

import { NavUnreadCountBadge } from "@/components/nav-unread-count-badge"
import { useLiveUnreadSupportCount } from "@/components/features/support/use-live-unread-support-count"
import { cn } from "@/lib/utils"

interface SupportUnreadTickerProps {
  initialCount?: number
  className?: string
  overlay?: boolean
}

export function SupportUnreadTicker({
  initialCount = 0,
  className,
  overlay = false,
}: SupportUnreadTickerProps) {
  const count = useLiveUnreadSupportCount(initialCount)
  return <NavUnreadCountBadge count={count} overlay={overlay} className={className} />
}

export function SupportUnreadCountLabel({
  initialCount = 0,
  className,
}: {
  initialCount?: number
  className?: string
}) {
  const count = useLiveUnreadSupportCount(initialCount)
  if (count <= 0) return null
  return (
    <span className={cn("tabular-nums text-muted-foreground", className)}>
      ({count > 99 ? "99+" : count})
    </span>
  )
}
