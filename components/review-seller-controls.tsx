"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { ChevronRight, Info, Star } from "lucide-react"
import { ratingStarEmptyClassName, ratingStarFilledClassName } from "@/lib/rating-star-styles"
import { cn } from "@/lib/utils"
import { SellerRatingStarRow } from "@/components/seller-rating-stars"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { LocalDateOnly, LocalDateTime } from "@/components/ui/local-datetime"
import { SellerReviewDialog } from "@/components/features/messages/seller-review-dialog"
import { MarketplaceReviewPhotos } from "@/components/features/reviews/marketplace-review-photos"
import type { ExistingMarketplaceReview } from "@/lib/types/marketplace-review"

const STAR_FILLED = ratingStarFilledClassName
const STAR_EMPTY = ratingStarEmptyClassName

function StarRow({ value }: { value: number }) {
  const clamped = Math.min(5, Math.max(0, value))
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.min(1, Math.max(0, clamped - i))
        return (
          <span key={i} className="relative inline-flex h-5 w-5 shrink-0">
            <Star className={cn("absolute inset-0 h-5 w-5", STAR_EMPTY)} strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={cn("h-5 w-5", STAR_FILLED)} strokeWidth={0} />
            </span>
          </span>
        )
      })}
    </div>
  )
}

export type ExistingSellerReview = ExistingMarketplaceReview

function CompactExistingReview({ review }: { review: ExistingSellerReview }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm leading-snug text-muted-foreground">
        <div className="inline-flex shrink-0" role="img" aria-label={`${review.rating} out of 5`}>
          <SellerRatingStarRow value={review.rating} size="sm" />
        </div>
        <span>Your review</span>
        <span className="inline-flex items-center gap-x-1.5">
          <span className="tabular-nums">{review.rating}/5</span>
          <span aria-hidden>·</span>
          <LocalDateOnly iso={review.created_at} dateStyle="medium" />
        </span>
      </div>
      {review.comment ? (
        <p className="mt-0.5 text-sm leading-snug text-muted-foreground whitespace-pre-wrap">{review.comment}</p>
      ) : null}
      <MarketplaceReviewPhotos reviewId={review.id} photos={review.photos} size="sm" className="mt-1.5" />
    </div>
  )
}

type ReviewSellerControlsProps = {
  orderId: string
  sellerName: string
  canReview: boolean
  existingReview: ExistingSellerReview | null
  /** When true, use compact layout (e.g. purchases list). */
  compact?: boolean
  /** Row matches the purchase details list style. */
  appearance?: "button" | "row"
  /** Called after a new review is saved (e.g. refetch client-loaded purchase lists). */
  onSuccess?: () => void
}

export function ReviewSellerControls({
  orderId,
  sellerName,
  canReview,
  existingReview,
  compact,
  appearance = "button",
  onSuccess,
}: ReviewSellerControlsProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  if (existingReview) {
    if (compact) {
      return <CompactExistingReview review={existingReview} />
    }

    return (
      <Card className="border-primary/15 bg-gradient-to-b from-primary/[0.04] to-background">
        <CardContent className="px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary/80">Your review</p>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StarRow value={existingReview.rating} />
            <span className="text-sm font-medium tabular-nums">{existingReview.rating}/5</span>
            <span className="ml-auto text-xs text-muted-foreground">
              <LocalDateTime iso={existingReview.created_at} dateStyle="medium" timeStyle="short" />
            </span>
          </div>
          {existingReview.comment ? (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{existingReview.comment}</p>
          ) : (
            <p className="text-sm italic text-muted-foreground">No written comment.</p>
          )}
          <MarketplaceReviewPhotos reviewId={existingReview.id} photos={existingReview.photos} />
        </CardContent>
      </Card>
    )
  }

  if (!canReview) {
    return null
  }

  return (
    <>
      {appearance === "row" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-left dark:bg-slate-900/40"
        >
          <Star className={cn("h-4 w-4 shrink-0", ratingStarFilledClassName)} strokeWidth={0} aria-hidden />
          <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
            Leave a review for the seller
          </span>
          <Info className="h-4 w-4 shrink-0 text-blue-500" aria-hidden />
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      ) : (
        <Button
          type="button"
          variant={compact ? "outline" : "default"}
          size={compact ? "sm" : "default"}
          className={cn(compact ? "h-8 w-fit gap-1.5 px-2.5" : "gap-2")}
          onClick={() => setOpen(true)}
        >
          <Star className={cn("h-4 w-4", ratingStarFilledClassName)} strokeWidth={0} />
          Review seller
        </Button>
      )}

      <SellerReviewDialog
        orderId={orderId}
        sellerName={sellerName}
        open={open}
        onOpenChange={setOpen}
        onSuccess={() => {
          onSuccess?.()
          router.refresh()
        }}
      />
    </>
  )
}
