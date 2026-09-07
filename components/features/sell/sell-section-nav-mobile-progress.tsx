"use client"

import { cn } from "@/lib/utils"
import type { SellSectionNavItem } from "@/components/features/sell/sell-section-nav"

/**
 * Mobile progress strip — replaces the cramped horizontal stepper.
 * Matches Reverb-style mobile: section title leads; progress stays quiet.
 */
export function SellSectionNavMobileProgress({
  items,
  activeSectionId,
  className,
}: {
  items: readonly SellSectionNavItem[]
  activeSectionId?: string | null
  className?: string
}) {
  const activeIndex = activeSectionId
    ? items.findIndex((item) => item.id === activeSectionId)
    : -1
  const step = activeIndex >= 0 ? activeIndex + 1 : 1
  const total = items.length
  const progress = total > 0 ? step / total : 0
  const label =
    activeIndex >= 0
      ? (items[activeIndex]?.shortLabel ?? items[activeIndex]?.label)
      : null

  return (
    <div
      className={cn("space-y-3", className)}
      role="status"
      aria-label={`Step ${step} of ${total}${label ? `: ${label}` : ""}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          Step {step} of {total}
        </p>
        {label ? (
          <p className="truncate text-sm font-medium text-foreground">{label}</p>
        ) : null}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-midgray/25">
        <div
          className="h-full rounded-full bg-listingHeart transition-[width] duration-300 ease-out"
          style={{ width: `${Math.max(progress * 100, 8)}%` }}
        />
      </div>
    </div>
  )
}
