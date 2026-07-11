import { ShoppingCart } from "lucide-react"

import { cn } from "@/lib/utils"

interface ListingDetailEngagementMetricsProps {
  views: number
  watchers: number
  cartHolderCount: number
  isSold?: boolean
  className?: string
}

export function ListingDetailEngagementMetrics({
  views,
  watchers,
  cartHolderCount,
  isSold = false,
  className,
}: ListingDetailEngagementMetricsProps) {
  if (isSold) return null

  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[14px] text-muted-foreground",
        className,
      )}
    >
      <span>
        Views:{" "}
        <span className="font-medium tabular-nums text-foreground/80">
          {Number.isFinite(views) ? views : 0}
        </span>
      </span>
      <span>
        Watchers:{" "}
        <span className="font-medium tabular-nums text-foreground/80">
          {Number.isFinite(watchers) ? watchers : 0}
        </span>
      </span>
      {cartHolderCount > 0 ? (
        <span className="inline-flex items-center gap-1">
          <ShoppingCart className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
          <span className="font-medium text-foreground/80">
            {cartHolderCount === 1
              ? "In someone’s cart"
              : `In ${cartHolderCount} buyers’ carts`}
          </span>
        </span>
      ) : null}
    </div>
  )
}
