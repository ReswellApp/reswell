import Link from "next/link"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { INDEX_DIRECTORY_BASE } from "@/lib/index-directory/routes"

/** Gold fill + stroke so Lucide stars stay visible (strokeWidth 0 + Tailwind fill often renders empty). */
const STAR_FILL = "#fbbf24"
const STAR_STROKE = "#d97706"

const starSlot =
  "relative inline-block h-4 w-4 shrink-0 sm:h-[1.125rem] sm:w-[1.125rem]"
const starFull =
  "pointer-events-none absolute left-0 top-0 h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]"

export function AccentStarRow({ value }: { value: number }) {
  const clamped = Math.min(5, Math.max(0, value))
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.min(1, Math.max(0, clamped - i))
        return (
          <span key={i} className={starSlot}>
            <Star
              className={cn(starFull, "text-muted-foreground/40")}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.35}
            />
            <span
              className={cn(starFull, "overflow-hidden")}
              style={{ width: `${fill * 100}%` }}
            >
              <Star
                className={starFull}
                fill={STAR_FILL}
                stroke={STAR_STROKE}
                strokeWidth={1.15}
              />
            </span>
          </span>
        )
      })}
    </div>
  )
}

export function BoardModelRatingSection({
  brandSlug,
  modelSlug,
  modelName,
  avgRating,
  reviewCount,
  className,
}: {
  brandSlug: string
  modelSlug: string
  modelName: string
  avgRating: number
  reviewCount: number
  className?: string
}) {
  const href = `${INDEX_DIRECTORY_BASE}/brands/${brandSlug}/models/${modelSlug}/reviews`
  const hasReviews = reviewCount > 0
  const starValue = hasReviews ? avgRating : 0

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/40 bg-muted/20 px-5 py-4 shadow-sm",
        className,
      )}
    >
      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-left">
        Rider reviews
      </p>
      <div className="mt-3 flex flex-col items-center gap-3 sm:mt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <span
          role="img"
          className="flex flex-col items-center gap-2 sm:inline-flex sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5"
          aria-label={
            hasReviews
              ? `Average ${avgRating.toFixed(1)} out of 5 stars from ${reviewCount} reviews for ${modelName}`
              : `No reviews yet for ${modelName}`
          }
        >
          <AccentStarRow value={starValue} />
          <span className="text-sm font-medium tabular-nums text-foreground">
            {hasReviews ? (
              <>
                {avgRating.toFixed(1)}
                <span className="ml-1.5 text-muted-foreground font-normal">
                  · {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Be the first to review this model</span>
            )}
          </span>
        </span>
        <Link
          href={href}
          className="text-sm font-medium text-foreground underline decoration-foreground/25 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary/40 sm:shrink-0"
        >
          {hasReviews ? "Read all reviews" : "Write a review"}
        </Link>
      </div>
    </div>
  )
}
