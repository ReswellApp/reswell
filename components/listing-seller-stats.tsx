import { Star, Package } from "lucide-react"
import { cn } from "@/lib/utils"

const STAR_FILLED = "fill-neutral-900 text-neutral-900 dark:fill-neutral-100 dark:text-neutral-100"
const STAR_EMPTY = "fill-none stroke-neutral-300/90 text-neutral-300/90 dark:stroke-neutral-600 dark:text-neutral-600"
const RATING_COUNT = "text-neutral-600 dark:text-foreground/90"

function StarRow({ value }: { value: number }) {
  const clamped = Math.min(5, Math.max(0, value))
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.min(1, Math.max(0, clamped - i))
        return (
          <span key={i} className="relative inline-flex h-4 w-4 shrink-0" aria-hidden>
            <Star
              className={cn("absolute inset-0 h-4 w-4", STAR_EMPTY)}
              strokeWidth={1.35}
            />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <Star
                className={cn("h-4 w-4", STAR_FILLED)}
                strokeWidth={0}
              />
            </span>
          </span>
        )
      })}
    </div>
  )
}

export function ListingSellerStats({
  avgRating,
  reviewCount,
  itemsSold,
  className,
}: {
  avgRating: number
  reviewCount: number
  itemsSold: number
  className?: string
}) {
  const sold = Math.max(0, Math.floor(itemsSold))
  const hasReviews = reviewCount > 0
  /** With reviews, stars reflect the average (including partial fills). With none, all stars stay outline-only. */
  const starValue = hasReviews ? avgRating : 0

  return (
    <div
      className={cn(
        "mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground",
        className,
      )}
    >
      <span
        role="img"
        className="inline-flex flex-wrap items-center"
        aria-label={
          hasReviews
            ? `Average ${avgRating.toFixed(1)} out of 5 stars from ${reviewCount} reviews`
            : "No ratings yet; zero reviews"
        }
      >
        <span className="inline-flex" aria-hidden>
          <StarRow value={starValue} />
        </span>
        <span
          className={cn(
            "ml-2.5 text-[15px] leading-none tabular-nums font-medium tracking-tight",
            RATING_COUNT,
          )}
          aria-hidden
        >
          ({reviewCount})
        </span>
      </span>
      <span className="flex items-center gap-1">
        <Package className="h-3.5 w-3.5 shrink-0" />
        <span>
          {sold} item{sold === 1 ? "" : "s"} sold
        </span>
      </span>
    </div>
  )
}
