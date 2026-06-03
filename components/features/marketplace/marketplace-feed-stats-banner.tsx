import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Shared stats strip above marketplace feed grids on `/sold`. */
export function MarketplaceFeedStatsBanner({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mb-6 flex min-h-[3.25rem] items-center justify-center rounded-lg border border-border bg-muted/30 px-4 py-3 text-center text-sm text-foreground",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function MarketplaceFeedSoldStatsBanner({
  count,
  gmvFormatted,
}: {
  count: number
  gmvFormatted: string
}) {
  return (
    <MarketplaceFeedStatsBanner>
      <span className="inline-flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
        <span aria-hidden>🤝</span>
        <span className="font-medium tabular-nums">{count}</span>
        <span>items sold on Reswell ·</span>
        <span className="font-medium tabular-nums text-listingHeart">{gmvFormatted}</span>
        <span>in sales</span>
      </span>
    </MarketplaceFeedStatsBanner>
  )
}

export function MarketplaceFeedNewListingsStatsBanner({ totalCount }: { totalCount: number }) {
  return (
    <MarketplaceFeedStatsBanner>
      <span className="inline-flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-muted-foreground">
        <span className="font-medium tabular-nums text-foreground">{totalCount}</span>
        <span>
          active {totalCount === 1 ? "listing" : "listings"} on Reswell
        </span>
      </span>
    </MarketplaceFeedStatsBanner>
  )
}
