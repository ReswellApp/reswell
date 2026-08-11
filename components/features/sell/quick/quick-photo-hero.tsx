"use client"

import {
  SellListingPhotoGrid,
  type SellListingPhotoGridProps,
} from "@/components/features/sell/sell-listing-photo-grid"
import { cn } from "@/lib/utils"

export type QuickPhotoHeroProps = SellListingPhotoGridProps & {
  className?: string
}

/**
 * Photo-first hero for Quick List: the existing sell photo pipeline
 * (SellListingPhotoGrid + useListingPhotoUpload) dressed as a large,
 * inviting drop surface at the top of the sheet. Wrapper only — the
 * upload/reorder/retry/rotate machinery is untouched.
 */
export function QuickPhotoHero({ className, ...gridProps }: QuickPhotoHeroProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-white p-5 shadow-surface sm:p-7",
        className,
      )}
    >
      <SellListingPhotoGrid
        {...gridProps}
        photoDescription={
          gridProps.photoDescription ??
          (gridProps.videoFileInputId
            ? "Photos sell boards. Drag to reorder — the first one is your cover. Optional: add one short video."
            : "Photos sell boards. Drag to reorder — the first one is your cover.")
        }
        photoTips={gridProps.photoTips ?? ["Deck", "Bottom", "Rails", "Any dings"]}
      />
    </section>
  )
}
