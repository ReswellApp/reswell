"use client"

import { useCallback, useEffect, useState } from "react"
import { format, isToday, isYesterday } from "date-fns"
import { CheckCircle2, Star } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ReviewRequestMessagePayload } from "@/lib/validations/review-request-message-metadata"
import type { ExistingSellerReview } from "@/components/review-seller-controls"
import { SellerReviewDialog } from "@/components/features/messages/seller-review-dialog"
import { LocalDateTime } from "@/components/ui/local-datetime"

function formatThreadTime(dateStr: string) {
  const date = new Date(dateStr)
  if (isToday(date)) return format(date, "h:mm a")
  if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`
  return format(date, "MMM d, h:mm a")
}

const STAR_FILLED = "fill-neutral-900 text-neutral-900 dark:fill-neutral-100 dark:text-neutral-100"
const STAR_EMPTY = "fill-none stroke-neutral-300/90 text-neutral-300/90 dark:stroke-neutral-600 dark:text-neutral-600"

function StarRow({ value }: { value: number }) {
  const clamped = Math.min(5, Math.max(0, value))
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.min(1, Math.max(0, clamped - i))
        return (
          <span key={i} className="relative inline-flex h-5 w-5 shrink-0">
            <Star className={cn("absolute inset-0 h-5 w-5", STAR_EMPTY)} strokeWidth={1.35} />
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
    const { data: row } = await supabase
      .from("reviews")
      .select("id, rating, comment, created_at")
      .eq("order_id", orderId)
      .maybeSingle()

    if (
      row &&
      typeof row.id === "string" &&
      typeof row.rating === "number" &&
      typeof row.created_at === "string"
    ) {
      setExisting({
        id: row.id,
        rating: row.rating,
        comment: typeof row.comment === "string" ? row.comment : null,
        created_at: row.created_at,
      })
    } else {
      setExisting(null)
    }
  }, [viewerIsBuyer, orderId, supabase])

  useEffect(() => {
    void loadReview()
  }, [loadReview])

  return (
    <>
      <div
        className={cn(
          "w-full max-w-[min(100%,20rem)] rounded-[20px] border border-border/60 bg-card p-3.5 text-foreground shadow-sm sm:max-w-[min(100%,22rem)]",
          "ring-1 ring-foreground/[0.04]",
        )}
      >
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-500/12">
            <Star className="h-5 w-5 text-amber-700 dark:text-amber-400" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Review request
            </p>
            <p className="mt-0.5 truncate text-[17px] font-semibold leading-snug tracking-[-0.02em]">
              #{orderNum}
            </p>
          </div>
        </div>

        <p className="mt-3 line-clamp-3 text-[15px] leading-snug text-foreground/90">{listingTitle}</p>

        {viewerIsBuyer ? (
          existing ? (
            <div className="mt-3 rounded-2xl border border-primary/15 bg-primary/[0.04] px-3 py-2.5">
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
                <p className="mt-2 text-[14px] leading-snug text-muted-foreground whitespace-pre-wrap">
                  {existing.comment}
                </p>
              ) : null}
            </div>
          ) : (
            <Button
              type="button"
              className="mt-3 h-10 w-full rounded-xl text-[15px] font-semibold"
              variant="default"
              onClick={() => setReviewOpen(true)}
            >
              Write review
            </Button>
          )
        ) : (
          <p className="mt-3 rounded-2xl bg-muted/45 px-3 py-2.5 text-[14px] leading-snug text-foreground/90">
            You asked the buyer to leave a review for this order.
          </p>
        )}

        <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">{formatThreadTime(createdAt)}</p>
      </div>

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
