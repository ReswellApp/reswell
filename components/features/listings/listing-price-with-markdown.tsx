import { cn } from "@/lib/utils"
import { listingCompareAtPriceForDisplay } from "@/lib/listing-compare-at-price"

export function ListingPriceWithMarkdown({
  priceUsd,
  compareAtPriceUsd,
  priceClassName,
  compareClassName,
  className,
}: {
  priceUsd: number
  compareAtPriceUsd?: number | string | null
  priceClassName?: string
  compareClassName?: string
  className?: string
}) {
  const compareAt = listingCompareAtPriceForDisplay(priceUsd, compareAtPriceUsd)

  if (compareAt == null) {
    return <span className={cn("tabular-nums", priceClassName)}>${priceUsd.toFixed(2)}</span>
  }

  return (
    <span
      className={cn("inline-flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}
      aria-label={`Now $${priceUsd.toFixed(2)}, was $${compareAt.toFixed(2)}`}
    >
      <span className={cn("tabular-nums", priceClassName)}>${priceUsd.toFixed(2)}</span>
      <span
        className={cn(
          "text-muted-foreground line-through tabular-nums",
          compareClassName ?? "text-sm font-normal",
        )}
      >
        ${compareAt.toFixed(2)}
      </span>
    </span>
  )
}
