import Link from "next/link"
import { Star } from "lucide-react"
import { reswellPlatformRatingLabel } from "@/lib/reswell-platform-rating-labels"
import type { ReswellPlatformReviewSummary } from "@/lib/db/reswellPlatformReviews"
import {
  ReswellPlatformSingleStar,
  ReswellPlatformStarBoxRow,
} from "@/components/features/reswell/reswell-platform-star-boxes"
import { cn } from "@/lib/utils"

interface ReswellPlatformRatingWidgetProps {
  summary: ReswellPlatformReviewSummary
  className?: string
  /** When false, renders as a static summary block instead of a link. */
  linked?: boolean
}

export function ReswellPlatformRatingWidget({
  summary,
  className,
  linked = true,
}: ReswellPlatformRatingWidgetProps) {
  const { avgRating, reviewCount } = summary
  const hasReviews = reviewCount > 0
  const label = hasReviews ? reswellPlatformRatingLabel(avgRating) : "Rate us"
  const starValue = hasReviews ? avgRating : 0

  const content = (
    <>
      <p className="text-center text-[13px] text-muted-foreground transition-colors group-hover:text-foreground">
        Our users rate Reswell
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <span className="text-[15px] font-bold text-foreground underline decoration-2 underline-offset-[5px]">
          {label}
        </span>

        <ReswellPlatformStarBoxRow value={starValue} />

        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground">
          <ReswellPlatformSingleStar className={cn("h-3.5 w-3.5", !hasReviews && "opacity-40")} />
          Reswell
        </span>
      </div>
    </>
  )

  if (!linked) {
    return (
      <div
        className={cn(
          "border-b border-neutral-200/90 pb-5 pt-1 dark:border-neutral-700/70",
          className,
        )}
        aria-label={
          hasReviews
            ? `Our users rate Reswell ${avgRating.toFixed(1)} out of 5 from ${reviewCount} reviews.`
            : "No Reswell reviews yet."
        }
      >
        {content}
      </div>
    )
  }

  return (
    <Link
      href="/reswellreviews"
      className={cn(
        "group block border-b border-neutral-200/90 pb-5 pt-1 transition-colors dark:border-neutral-700/70",
        className,
      )}
      aria-label={
        hasReviews
          ? `Our users rate Reswell ${avgRating.toFixed(1)} out of 5 from ${reviewCount} reviews. View all reviews.`
          : "View Reswell reviews — be the first to share your experience."
      }
    >
      {content}
    </Link>
  )
}
