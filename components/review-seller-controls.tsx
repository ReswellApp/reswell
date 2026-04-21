"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2, Star } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { LocalDateTime } from "@/components/ui/local-datetime"

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

export type ExistingSellerReview = {
  id: string
  rating: number
  comment: string | null
  created_at: string
}

type ReviewSellerControlsProps = {
  orderId: string
  sellerName: string
  canReview: boolean
  existingReview: ExistingSellerReview | null
  /** When true, use compact layout (e.g. orders list). */
  compact?: boolean
  /** Called after a new review is saved (e.g. refetch client-loaded order lists). */
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
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)

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
        </CardContent>
      </Card>
    )
  }

  if (!canReview) {
    return null
  }

  const submit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/review`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment: comment.trim() || undefined,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Could not save your review")
        return
      }
      toast.success("Thanks — your review was posted.")
      setOpen(false)
      setComment("")
      onSuccess?.()
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    } finally {
      setSubmitting(false)
    }
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
        <Star className="h-4 w-4" />
        Review seller
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review {sellerName}</DialogTitle>
            <DialogDescription>
              Rate your experience for this purchase. You can submit one review per order; it appears on the
              seller&apos;s profile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label>Rating</Label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className="rounded-md p-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  >
                    <Star
                      className={cn(
                        "h-8 w-8",
                        n <= rating
                          ? "fill-amber-500 text-amber-500"
                          : "fill-none stroke-muted-foreground text-muted-foreground",
                      )}
                      strokeWidth={n <= rating ? 0 : 1.35}
                    />
                  </button>
                ))}
                <span className="text-sm text-muted-foreground tabular-nums ml-1">{rating}/5</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`review-comment-${orderId}`}>Written review (optional)</Label>
              <Textarea
                id={`review-comment-${orderId}`}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Share how the sale went — communication, item condition, pickup or shipping…"
              />
              <p className="text-xs text-muted-foreground text-right">{comment.length}/2000</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={submitting || rating < 1} onClick={() => void submit()}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
