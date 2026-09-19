import { Star } from "lucide-react"
import {
  threadsStarEmptyClassName,
  threadsStarFilledClassName,
} from "@/components/features/forum/threads-brand-styles"
import { cn } from "@/lib/utils"

export function ModelPageStars({
  rating,
  className,
}: {
  rating: number
  className?: string
}) {
  const rounded = Math.round(rating)
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < rounded ? threadsStarFilledClassName : threadsStarEmptyClassName,
          )}
        />
      ))}
    </span>
  )
}
