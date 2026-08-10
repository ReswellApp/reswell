"use client"

import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  SELL_FORM_COLUMN_CLASS,
  SELL_PRIMARY_BUTTON_CLASS,
} from "@/components/features/sell/sell-form-surface"
import { cn } from "@/lib/utils"

export interface QuickPublishBarProps {
  /** Friendly labels for what's still needed (e.g. "a photo", "price"). */
  missing: string[]
  /** Photos still optimizing/uploading — publish waits on these. */
  uploadingPhotos: boolean
  publishing: boolean
}

function joinFriendly(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ""
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
}

/**
 * Sticky publish bar for Quick List — same primary button treatment as
 * Guided / Advanced (`SELL_PRIMARY_BUTTON_CLASS`, full width).
 */
export function QuickPublishBar({
  missing,
  uploadingPhotos,
  publishing,
}: QuickPublishBarProps) {
  const ready = missing.length === 0 && !uploadingPhotos

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className={cn("mx-auto space-y-2.5 px-4 py-3 sm:py-4", SELL_FORM_COLUMN_CLASS)}>
        <p
          className={cn(
            "text-center text-xs leading-snug sm:text-sm",
            ready ? "font-medium text-listingHeart" : "text-muted-foreground",
          )}
          aria-live="polite"
        >
          {uploadingPhotos
            ? "Photos are still uploading…"
            : ready
              ? "Everything's set — ready when you are."
              : `${joinFriendly(missing)} still needed`}
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={publishing}
          className={cn("w-full relative transition-shadow", SELL_PRIMARY_BUTTON_CLASS)}
        >
          {publishing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Publishing…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" aria-hidden />
              Publish listing
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
