import { cn } from "@/lib/utils"

/**
 * Marketplace listing tiles (grids, feeds, `ListingTile` default): no panel at rest so they blend
 * into the section background; border, fill, and shadow on hover / focus-within — same as homepage
 * horizontal surfboard rows.
 */
export const listingProductCardClassName =
  "group overflow-visible rounded-xl border border-transparent bg-transparent shadow-none transition-[background-color,border-color,box-shadow] duration-200 hover:border-border hover:bg-card hover:shadow-md focus-within:border-border focus-within:bg-card focus-within:shadow-md"

/**
 * Bordered card panel always visible (dashboard listing rows, seller directory, featured shop cards).
 */
export const listingProductCardSolidClassName =
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
