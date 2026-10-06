"use client"

import Link from "next/link"
import { useLiveUnreadSupportCount } from "@/components/features/support/use-live-unread-support-count"
import { cn } from "@/lib/utils"

interface OverviewAttentionProps {
  pendingOffers: number
  unreadCount: number
  unreadSupportCount: number
  newFollowersThisMonth: number
}

interface AttentionChip {
  key: string
  label: string
  count: number
  href: string
}

export function OverviewAttention({
  pendingOffers,
  unreadCount,
  unreadSupportCount,
  newFollowersThisMonth,
}: OverviewAttentionProps) {
  const supportCount = useLiveUnreadSupportCount(unreadSupportCount)
  const chips: AttentionChip[] = [
    pendingOffers > 0
      ? {
          key: "offers",
          label: "Offers",
          count: pendingOffers,
          href: "/dashboard/offers?tab=received",
        }
      : null,
    unreadCount > 0
      ? {
          key: "unread",
          label: "Unread",
          count: unreadCount,
          href: "/messages",
        }
      : null,
    supportCount > 0
      ? {
          key: "support",
          label: "Support",
          count: supportCount,
          href: "/dashboard/support",
        }
      : null,
    newFollowersThisMonth > 0
      ? {
          key: "followers",
          label: "New followers",
          count: newFollowersThisMonth,
          href: "/dashboard/following?tab=followers",
        }
      : null,
  ].filter((chip): chip is AttentionChip => chip !== null)

  if (chips.length === 0) return null

  return (
    <nav aria-label="Needs attention" className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.href}
          aria-label={`${chip.label}, ${chip.count.toLocaleString()}`}
          className="inline-flex h-10 shrink-0 items-center gap-2.5 rounded-full border border-border bg-card pl-3.5 pr-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {chip.label}
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-foreground px-2 text-xs tabular-nums text-primary-foreground">
            {chip.count.toLocaleString()}
          </span>
        </Link>
      ))}
    </nav>
  )
}

export function OverviewSupportDetail({ initialCount }: { initialCount: number }) {
  const count = useLiveUnreadSupportCount(initialCount)
  const open = count > 0

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 tabular-nums",
        open ? "font-medium text-foreground" : "text-muted-foreground",
      )}
    >
      {open ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-listingHeart" aria-hidden /> : null}
      {open ? `${count.toLocaleString()} open` : "Clear"}
    </span>
  )
}
