"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Star } from "lucide-react"
import { ratingStarEmptyClassName, ratingStarFilledClassName } from "@/lib/rating-star-styles"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { LocalDateTime } from "@/components/ui/local-datetime"
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

type ReviewSellerControlsProps = {
  orderId: string
  sellerName: string
  canReview: boolean
  existingReview: ExistingSellerReview | null
  /** When true, use compact layout (e.g. purchases list). */
  compact?: boolean
  /** Called after a new review is saved (e.g. refetch client-loaded purchase lists). */
  onSuccess?: () => void
}

export function ReviewSellerControls({
  orderId,
  sellerName,
  canReview,
  existingReview,
  compact,
  onSuccess,
}: ReviewSellerControlsProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  if (existingReview) {
    return (
      <Card
        className={cn(
          "border-primary/15 bg-gradient-to-b from-primary/[0.04] to-background",
          compact && "shadow-none",
        )}
      >
        <CardContent className={cn("py-3", compact ? "px-3" : "px-4")}>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/80 mb-2">Your review</p>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <StarRow value={existingReview.rating} />
            <span className="text-sm font-medium tabular-nums">{existingReview.rating}/5</span>
            <span className="text-xs text-muted-foreground ml-auto">
              <LocalDateTime iso={existingReview.created_at} dateStyle="medium" timeStyle="short" />
            </span>
          </div>
          {existingReview.comment ? (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{existingReview.comment}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No written comment.</p>
          )}
          <MarketplaceReviewPhotos
            reviewId={existingReview.id}
            photos={existingReview.photos}
            size={compact ? "sm" : "md"}
          />
        </CardContent>
      </Card>
    )
  }

  if (!canReview) {
    return null
  }

  return (
    <>
      <Button
        type="button"
        variant={compact ? "outline" : "default"}
        size={compact ? "sm" : "default"}
        className={cn("gap-2", compact && "w-full sm:w-auto")}
        onClick={() => setOpen(true)}
      >
        <Star className={cn("h-4 w-4", ratingStarFilledClassName)} strokeWidth={0} />
        Review seller
      </Button>

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
