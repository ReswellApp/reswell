"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Star } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ReviewRequestMessagePayload } from "@/lib/validations/review-request-message-metadata"
import { existingMarketplaceReviewFromRow, isReviewsMetadataColumnMissing } from "@/lib/marketplace-review-photos"
import { MarketplaceReviewPhotos } from "@/components/features/reviews/marketplace-review-photos"
import type { ExistingSellerReview } from "@/components/review-seller-controls"
import { SellerReviewDialog } from "@/components/features/messages/seller-review-dialog"
import { LocalDateTime } from "@/components/ui/local-datetime"
import { ratingStarEmptyClassName, ratingStarFilledClassName } from "@/lib/rating-star-styles"
import {
  THREAD_EVENT_CTA_CLASS,
  ThreadEventActions,
  ThreadEventCard,
  ThreadEventHint,
  ThreadEventListings,
} from "@/components/features/messages/thread-event-card"

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

export function ReviewRequestMessageCard({
  payload,
  createdAt,
  viewerIsBuyer,
  sellerDisplayName,
  onAfterReviewSubmitted,
}: {
  payload: ReviewRequestMessagePayload
  createdAt: string
  viewerIsBuyer: boolean
  sellerDisplayName: string
  onAfterReviewSubmitted?: () => void
}) {
  const { orderId, orderNum, listingTitle } = payload
  const [reviewOpen, setReviewOpen] = useState(false)
  const [existing, setExisting] = useState<ExistingSellerReview | null>(null)
  const supabase = createClient()

  const loadReview = useCallback(async () => {
    if (!viewerIsBuyer) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    let { data: row, error } = await supabase
      .from("reviews")
      .select("id, rating, comment, created_at, metadata")
      .eq("order_id", orderId)
      .eq("reviewer_id", user.id)
      .maybeSingle()

    if (error && isReviewsMetadataColumnMissing(error)) {
      ;({ data: row } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at")
        .eq("order_id", orderId)
        .eq("reviewer_id", user.id)
        .maybeSingle())
    }

    if (
      row &&
      typeof row.id === "string" &&
      typeof row.rating === "number" &&
      typeof row.created_at === "string"
    ) {
      setExisting(existingMarketplaceReviewFromRow({
        id: row.id,
        rating: row.rating,
        comment: typeof row.comment === "string" ? row.comment : null,
        created_at: row.created_at,
        metadata: row.metadata,
      }))
    } else {
      setExisting(null)
    }
  }, [viewerIsBuyer, orderId, supabase])

  useEffect(() => {
    void loadReview()
  }, [loadReview])

  return (
    <>
      <ThreadEventCard
        icon={Star}
        tone="accent"
        title="Review requested"
        subtitle={`#${orderNum}`}
        createdAt={createdAt}
      >
        <ThreadEventListings titles={[listingTitle]} />
        {viewerIsBuyer ? (
          existing ? (
            <div className="rounded-xl border border-primary/15 bg-primary/[0.04] px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-primary/90">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                You reviewed this seller
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StarRow value={existing.rating} />
                <span className="text-sm font-medium tabular-nums">{existing.rating}/5</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  <LocalDateTime iso={existing.created_at} dateStyle="medium" timeStyle="short" />
                </span>
              </div>
              {existing.comment ? (
                <p className="mt-2 text-[13px] leading-snug text-muted-foreground whitespace-pre-wrap">
                  {existing.comment}
                </p>
              ) : null}
              <MarketplaceReviewPhotos reviewId={existing.id} photos={existing.photos} size="sm" />
            </div>
          ) : (
            <ThreadEventActions>
              <Button
                type="button"
                className={THREAD_EVENT_CTA_CLASS}
                variant="default"
                onClick={() => setReviewOpen(true)}
              >
                Write review
              </Button>
            </ThreadEventActions>
          )
        ) : (
          <ThreadEventHint>A review request was sent to the buyer for this sale.</ThreadEventHint>
        )}
      </ThreadEventCard>

      {viewerIsBuyer && !existing ? (
        <SellerReviewDialog
          orderId={orderId}
          sellerName={sellerDisplayName}
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          onSuccess={() => void loadReview().then(() => onAfterReviewSubmitted?.())}
        />
      ) : null}
    </>
  )
}
