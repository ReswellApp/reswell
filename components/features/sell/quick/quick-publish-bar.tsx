"use client"

import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SELL_PRIMARY_BUTTON_CLASS } from "@/components/features/sell/sell-form-surface"
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
 * Sticky publish bar for Quick List: one big primary action plus a compact
 * live readout of what's still needed before the listing can go live.
 */
export function QuickPublishBar({
  missing,
  uploadingPhotos,
  publishing,
}: QuickPublishBarProps) {
  const ready = missing.length === 0 && !uploadingPhotos

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-4 px-4 py-3 sm:py-4">
        <p
          className={cn(
            "min-w-0 flex-1 text-xs leading-snug sm:text-sm",
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
          className={cn(
            "h-12 shrink-0 rounded-xl px-6 text-base font-semibold shadow-sm sm:px-8",
            SELL_PRIMARY_BUTTON_CLASS,
          )}
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
