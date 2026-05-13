"use client"

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

export type SellerReviewDialogProps = {
  orderId: string
  sellerName: string
  /** Who receives the rating: the seller (buyer's review) or the buyer (seller's review). */
  ratingSubject?: "seller" | "buyer"
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function SellerReviewDialog({
  orderId,
  sellerName,
  ratingSubject = "seller",
  open,
  onOpenChange,
  onSuccess,
}: SellerReviewDialogProps) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)

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
      onOpenChange(false)
      setComment("")
      onSuccess?.()
    } catch {
      toast.error("Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90svh,32rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review {sellerName}</DialogTitle>
          <DialogDescription>
            {ratingSubject === "buyer"
              ? "Rate this buyer for this completed sale. You can submit one review per order; it is tied to this purchase."
              : "Rate your experience for this purchase. You can submit one review per order; it appears on the seller's profile."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label>Rating</Label>
            <div className="flex flex-wrap items-center gap-2">
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
            <Label htmlFor={`review-comment-modal-${orderId}`}>Written review (optional)</Label>
            <Textarea
              id={`review-comment-modal-${orderId}`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder={
                ratingSubject === "buyer"
                  ? "Optional — e.g. communication, pickup, or payment reliability."
                  : "Optional. A quick note helps other buyers."
              }
            />
            <p className="text-xs text-muted-foreground text-right">{comment.length}/2000</p>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={submitting || rating < 1} onClick={() => void submit()}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
