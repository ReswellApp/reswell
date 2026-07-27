"use client"

import { Sparkles, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ExtractListingFromPhotosBannerProps = {
  open: boolean
  onDismiss: () => void
  onClearSuggestions: () => void
  className?: string
}

/** Soft review notice when AI filled empty board fields from listing photos. */
export function ExtractListingFromPhotosBanner({
  open,
  onDismiss,
  onClearSuggestions,
  className,
}: ExtractListingFromPhotosBannerProps) {
  if (!open) return null

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-listingHeart/25 bg-listingHeart/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-listingHeart" aria-hidden />
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium text-foreground">
            We filled some details from your photos
          </p>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Review dimensions and fin details before publishing — you can edit anything.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={onClearSuggestions}
        >
          Clear suggestions
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
