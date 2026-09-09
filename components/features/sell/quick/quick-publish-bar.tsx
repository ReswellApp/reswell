"use client"

import { Loader2 } from "lucide-react"
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
 * In-form publish block for Quick List — same primary button treatment as
 * Guided / Advanced (`SELL_PRIMARY_BUTTON_CLASS`, full width).
 */
export function QuickPublishBar({
  missing,
  uploadingPhotos,
  publishing,
}: QuickPublishBarProps) {
  const ready = missing.length === 0 && !uploadingPhotos

  return (
    <div className="space-y-2.5 border-t border-border pt-6 sm:pt-8">
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
          "Publish listing"
        )}
      </Button>
    </div>
  )
}
