import { cn } from "@/lib/utils"

/**
 * Standard classes for marketplace listing / product cards (grids, feeds, detail “more from seller”).
 * Matches homepage horizontal listing cards: rounded corners + hover shadow.
 */
export const listingProductCardClassName =
  "group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow duration-200 hover:shadow-md"

/** Grid cells that fill a track and use a column flex layout (most listing grids). */
export const listingProductCardGridClassName = cn(
  listingProductCardClassName,
  "min-w-0 h-full flex flex-col",
)

/**
 * Listing card title — matches PDP “Recently viewed” marketplace tiles (Stack Sans Headline, semibold).
 * Pair with `line-clamp-*` per layout (grids vs scroll bands).
 */
export const listingTileTitleHeadingClassName =
  "font-headline text-sm font-semibold tracking-normal leading-snug text-foreground"
