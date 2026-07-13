"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ImagePlus, Loader2, Star, X } from "lucide-react"
import { toast } from "sonner"
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
import {
  BoardTalkReviewCatalogPicker,
  type BoardTalkReviewCatalogSelection,
} from "@/components/features/forum/board-talk-review-catalog-picker"
import { submitBoardModelReview } from "@/app/actions/board-reviews"
import { uploadBoardReviewMediaFile } from "@/lib/board-review-media-upload-client"
import { createClient } from "@/lib/supabase/client"
import {
  threadsStarEmptyClassName,
  threadsStarFilledClassName,
} from "@/components/features/forum/threads-brand-styles"
import type { BoardReviewImageAttachment } from "@/lib/validations/board-review-attachment"
import { cn } from "@/lib/utils"

const MAX_COMMENT = 2000

type BoardTalkPostReviewDialogProps = {
  userId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function resetFormState() {
  return {
    catalogSelection: {
      brandSlug: null,
      brandName: null,
      modelSlug: null,
      modelName: null,
    } as BoardTalkReviewCatalogSelection,
    rating: 5,
    comment: "",
    photoFile: null as File | null,
    photoPreviewUrl: null as string | null,
  }
}

export function BoardTalkPostReviewDialog({
  userId,
  open,
  onOpenChange,
}: BoardTalkPostReviewDialogProps) {
  const router = useRouter()
  const photoInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const supabaseProjectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

  const [catalogSelection, setCatalogSelection] = useState<BoardTalkReviewCatalogSelection>({
    brandSlug: null,
    brandName: null,
    modelSlug: null,
    modelName: null,
  })
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function handleOpenChange(next: boolean) {
    if (!next) {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
      const fresh = resetFormState()
      setCatalogSelection(fresh.catalogSelection)
      setRating(fresh.rating)
      setComment(fresh.comment)
      setPhotoFile(fresh.photoFile)
      setPhotoPreviewUrl(fresh.photoPreviewUrl)
    }
    onOpenChange(next)
  }

  function handlePhotoSelected(files: FileList | null) {
    if (!files?.length) return
    const file = files[0]
    if (!file?.type.startsWith("image/")) {
      toast.error("Only photos are supported.")
      return
    }
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    setPhotoFile(file)
    setPhotoPreviewUrl(URL.createObjectURL(file))
  }

  function clearPhoto() {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    setPhotoFile(null)
    setPhotoPreviewUrl(null)
    if (photoInputRef.current) photoInputRef.current.value = ""
  }

  async function submit() {
    if (!catalogSelection.brandSlug || !catalogSelection.modelSlug) {
      toast.error("Pick a brand and model from the catalog.")
      return
    }

    setSubmitting(true)
    try {
      let attachment: Omit<BoardReviewImageAttachment, "bucket"> | undefined

      if (photoFile) {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session?.access_token) {
          toast.error("Sign in again to add a photo.")
          return
        }

        const uploaded = await uploadBoardReviewMediaFile({
          file: photoFile,
          reviewerId: userId,
          supabaseUrl: supabaseProjectUrl,
          accessToken: session.access_token,
          anonKey: supabaseAnonKey,
        })
        attachment = uploaded.attachment
      }

      const result = await submitBoardModelReview({
        brand_slug: catalogSelection.brandSlug,
        model_slug: catalogSelection.modelSlug,
        rating,
        comment: comment.trim() || undefined,
        attachment,
      })

      if ("error" in result) {
        toast.error(result.error)
        return
      }

      toast.success("Review posted")
      handleOpenChange(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not post review")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[min(92svh,40rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Post a board review</DialogTitle>
          <DialogDescription>
            Share your take on a catalog board model — rating, a short note, and an optional photo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <BoardTalkReviewCatalogPicker
            key={open ? "review-catalog-open" : "review-catalog-closed"}
            selection={catalogSelection}
            onSelectionChange={setCatalogSelection}
          />

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
                      n <= rating ? threadsStarFilledClassName : threadsStarEmptyClassName,
                    )}
                    strokeWidth={0}
                  />
                </button>
              ))}
              <span className="ml-1 text-sm tabular-nums text-muted-foreground">{rating}/5</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="board-review-comment">Short description</Label>
            <Textarea
              id="board-review-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              maxLength={MAX_COMMENT}
              placeholder="How does it paddle, turn, or feel in the water?"
            />
            <p className="text-right text-xs text-muted-foreground">{comment.length}/{MAX_COMMENT}</p>
          </div>

          <div className="space-y-2">
            <Label>Photo (optional)</Label>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={submitting}
              onChange={(event) => handlePhotoSelected(event.target.files)}
            />
            {photoPreviewUrl ? (
              <div className="relative inline-block max-w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreviewUrl}
                  alt="Review photo preview"
                  className="max-h-48 max-w-full rounded-xl border border-border/60 object-contain"
                />
                <button
                  type="button"
                  aria-label="Remove photo"
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm hover:text-foreground"
                  onClick={clearPhoto}
                >
                  <X className="h-4 w-4" />
                </button>
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
                Add a photo
              </Button>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={
              submitting ||
              rating < 1 ||
              !catalogSelection.brandSlug ||
              !catalogSelection.modelSlug
            }
            onClick={() => void submit()}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
