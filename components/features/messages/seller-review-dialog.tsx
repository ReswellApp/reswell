"use client"

import { useRef, useState } from "react"
import { ImagePlus, Loader2, Star, X } from "lucide-react"
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
import { ratingStarEmptyClassName, ratingStarFilledClassName } from "@/lib/rating-star-styles"
import { uploadMarketplaceReviewMediaFile } from "@/lib/marketplace-review-media-upload-client"
import { MARKETPLACE_REVIEW_MAX_PHOTOS } from "@/lib/validations/marketplace-review-attachment"
import type { MarketplaceReviewAttachmentInput } from "@/lib/validations/marketplace-review-attachment"
import { createClient } from "@/lib/supabase/client"

type PhotoDraft = {
  id: string
  file: File
  previewUrl: string
}

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
  const [photos, setPhotos] = useState<PhotoDraft[]>([])
  const [submitting, setSubmitting] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const supabaseProjectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

  function revokePhotos(drafts: PhotoDraft[]) {
    for (const draft of drafts) {
      URL.revokeObjectURL(draft.previewUrl)
    }
  }

  function resetForm() {
    revokePhotos(photos)
    setRating(5)
    setComment("")
    setPhotos([])
    if (photoInputRef.current) photoInputRef.current.value = ""
  }

  function handleOpenChange(next: boolean) {
    if (submitting) return
    if (!next) {
      resetForm()
    }
    onOpenChange(next)
  }

  function handlePhotoSelected(files: FileList | null) {
    if (!files?.length) return
    const remaining = MARKETPLACE_REVIEW_MAX_PHOTOS - photos.length
    if (remaining <= 0) {
      toast.error(`You can add up to ${MARKETPLACE_REVIEW_MAX_PHOTOS} photos.`)
      return
    }

    const next: PhotoDraft[] = []
    for (const file of Array.from(files).slice(0, remaining)) {
      if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name)) {
        toast.error("Only photos are supported.")
        continue
      }
      next.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      })
    }
    if (next.length === 0) return
    setPhotos((current) => [...current, ...next])
    if (photoInputRef.current) photoInputRef.current.value = ""
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return current.filter((photo) => photo.id !== id)
    })
    if (photoInputRef.current) photoInputRef.current.value = ""
  }

  const submit = async () => {
    setSubmitting(true)
    try {
      const attachments: MarketplaceReviewAttachmentInput[] = []

      if (photos.length > 0) {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session?.access_token) {
          toast.error("Sign in again to add photos.")
          return
        }
        if (!session.user?.id) {
          toast.error("Sign in again to add photos.")
          return
        }

        for (const photo of photos) {
          const uploaded = await uploadMarketplaceReviewMediaFile({
            file: photo.file,
            reviewerId: session.user.id,
            supabaseUrl: supabaseProjectUrl,
            accessToken: session.access_token,
            anonKey: supabaseAnonKey,
          })
          attachments.push(uploaded.attachment)
        }
      }

      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/review`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment: comment.trim() || undefined,
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Could not save your review")
        return
      }
      resetForm()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[min(90svh,40rem)] overflow-y-auto sm:max-w-lg">
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
                      n <= rating ? ratingStarFilledClassName : ratingStarEmptyClassName,
                    )}
                    strokeWidth={0}
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
          <div className="space-y-2">
            <Label>Photos (optional)</Label>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={submitting}
              onChange={(event) => handlePhotoSelected(event.target.files)}
            />
            {photos.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative h-20 w-20 overflow-hidden rounded-lg border border-border/60">
                    {/* Local blob preview — next/image is unnecessary here. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.previewUrl}
                      alt={photo.file.name}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      aria-label={`Remove ${photo.file.name}`}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm hover:text-foreground"
                      onClick={() => removePhoto(photo.id)}
                      disabled={submitting}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {photos.length < MARKETPLACE_REVIEW_MAX_PHOTOS ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-20 w-20 shrink-0 flex-col gap-1 text-xs"
                    disabled={submitting}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <ImagePlus className="h-4 w-4" />
                    Add
                  </Button>
                ) : null}
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                disabled={submitting}
                onClick={() => photoInputRef.current?.click()}
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                Add photos
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Up to {MARKETPLACE_REVIEW_MAX_PHOTOS} photos. Helpful for showing the item as it arrived.
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={submitting}>
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
