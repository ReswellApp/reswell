import { Star } from "lucide-react"
import { ratingStarEmptyClassName, ratingStarFilledClassName } from "@/lib/rating-star-styles"
import { cn } from "@/lib/utils"

const FILLED = ratingStarFilledClassName
const EMPTY = ratingStarEmptyClassName

type Size = "sm" | "md"

const sizeClass: Record<Size, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
}

/**
 * Five-star display with partial fills (e.g. average 4.3).
 */
export function SellerRatingStarRow({
  value,
  size = "sm",
  className,
}: {
  /** Average or rating on a 0–5 scale (clamped). */
  value: number
  size?: Size
  className?: string
}) {
  const clamped = Math.min(5, Math.max(0, value))

  return (
    <div className={cn("flex items-center gap-0.5", className)} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.min(1, Math.max(0, clamped - i))
        const dim = sizeClass[size]
        return (
          <span key={i} className={cn("relative inline-flex shrink-0", dim)}>
            <Star className={cn("absolute inset-0", dim, EMPTY)} strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={cn(dim, FILLED)} strokeWidth={0} />
            </span>
          </span>
        )
      })}
    </div>
  )
}
