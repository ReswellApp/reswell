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
 * dressed as a large drop surface at the top of the sheet.
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
            ? "Photos sell boards. A dropped batch runs from the first shot to the last — drag to reorder. The first photo is your cover. Optional: add one short video."
            : "Photos sell boards. A dropped batch runs from the first shot to the last — drag to reorder. The first photo is your cover.")
        }
        photoTips={gridProps.photoTips ?? ["Deck", "Bottom", "Rails", "Any dings"]}
      />
    </section>
  )
}
