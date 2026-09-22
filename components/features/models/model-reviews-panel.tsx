import Link from "next/link"
import { ModelPageSectionHeading } from "@/components/features/models/model-page-section"
import { ModelPageStars } from "@/components/features/models/model-page-stars"
import type { BoardModelReviewRow } from "@/lib/board-model-reviews"

export function ModelReviewsPanel({
  reviews,
  avgRating,
  reviewCount,
  modelName,
}: {
  reviews: BoardModelReviewRow[]
  avgRating: number
  reviewCount: number
  modelName: string
}) {
  return (
    <div>
      <ModelPageSectionHeading
        action={
          <Link
            href="/threads/reviews"
            className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Write a review
          </Link>
        }
      >
        Reviews
      </ModelPageSectionHeading>

      {reviewCount > 0 ? (
        <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ModelPageStars rating={avgRating} />
          {avgRating.toFixed(1)} · {reviewCount} review{reviewCount === 1 ? "" : "s"}
        </p>
      ) : null}

      {reviews.length > 0 ? (
        <ul className="mt-6 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/80 bg-background px-5">
          {reviews.map((review) => (
            <li key={review.id} className="py-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">
                  {review.profiles?.display_name?.trim() || "Reswell rider"}
                </p>
                <ModelPageStars rating={review.rating} />
              </div>
              {review.comment?.trim() ? (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{review.comment.trim()}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-2xl border border-dashed border-border/80 bg-background px-5 py-10 text-center text-sm text-muted-foreground">
          No reviews for the {modelName} yet.
        </p>
      )}
    </div>
  )
}
