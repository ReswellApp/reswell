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
import type { ExistingSellerReview } from "@/components/review-seller-controls"

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

type ReviewBuyerControlsProps = {
  orderId: string
  buyerName: string
  canReview: boolean
  existingReview: ExistingSellerReview | null
  compact?: boolean
  onSuccess?: () => void
}

export function ReviewBuyerControls({
  orderId,
  buyerName,
  canReview,
  existingReview,
  compact,
  onSuccess,
}: ReviewBuyerControlsProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  if (existingReview) {
    return (
      <Card
        className={cn(
          "border-muted-foreground/20 bg-muted/30",
          compact && "shadow-none",
        )}
      >
        <CardContent className={cn("py-3", compact ? "px-3" : "px-4")}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Your buyer review
          </p>
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
        Review buyer
      </Button>

      <SellerReviewDialog
        orderId={orderId}
        sellerName={buyerName}
        ratingSubject="buyer"
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
