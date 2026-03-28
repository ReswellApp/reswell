import { cn } from "@/lib/utils"

/**
 * Standard classes for marketplace listing / product cards (grids, feeds, detail “more from seller”).
 * Matches homepage horizontal listing cards: rounded corners + hover shadow.
 */
export const listingProductCardClassName =
  "group overflow-hidden rounded-xl hover:shadow-lg transition-shadow"

/** Grid cells that fill a track and use a column flex layout (most listing grids). */
export const listingProductCardGridClassName = cn(
  listingProductCardClassName,
  "min-w-0 h-full flex flex-col",
)
