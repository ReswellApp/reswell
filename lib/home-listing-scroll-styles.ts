import {
  listingProductCardClassName,
  listingProductCardGridClassName,
  listingTileTitleHeadingClassName,
} from "@/lib/listing-card-styles"
import { cn } from "@/lib/utils"

/** ~2 full cards + peek of 3rd on mobile; fixed width from `sm` up. */
export const homeListingScrollCardClass = cn(
  listingProductCardGridClassName,
  "shrink-0 snap-start w-[calc((100vw-1rem-2.25rem)/2.25)] sm:w-52",
)

/** Equal-height carousel columns: stretch wrapper + flex-1 card (see `HomeListingScrollRow`). */
export const homeUniformScrollCarouselTileWrapClass = cn(
  "flex min-h-0 shrink-0 snap-start self-stretch flex-col",
  "w-[calc((100vw-1rem-2.25rem)/2.25)] sm:w-52",
)

/** Fills {@link homeUniformScrollCarouselTileWrapClass}; width/snap live on the wrapper. */
export const homeUniformScrollCardClass = cn(
  listingProductCardClassName,
  "flex min-h-0 min-w-0 w-full flex-1 flex-col",
)

export const homeListingScrollImageSizes = "(max-width: 639px) 44vw, 208px"

export const homeUniformScrollLinkClass = "flex min-h-0 h-full min-w-0 flex-1 flex-col"
/** Homepage horizontal tiles — tight inset under image (Reverb-style text stack). */
export const homeUniformScrollBodyClass =
  "flex min-h-0 min-w-0 flex-1 flex-col px-2.5 pb-2.5 pt-2.5"
/** Title wraps naturally (no fixed band); keeps scroll rows visually compact. */
export const homeUniformScrollTitleSlotClass = "min-w-0 shrink-0"
export const homeUniformScrollMetaFooterClass = "mt-2 w-full shrink-0 flex flex-col gap-1.5"

/** Homepage listing tile title — bold, slightly larger than grid marketplace tiles. */
export const homePeerListingTileTitleClass = cn(
  listingTileTitleHeadingClassName,
  "text-[15px] font-semibold leading-snug tracking-tight text-foreground line-clamp-3 sm:text-base",
)

/** Muted second line under title (condition / category). */
export const homePeerTileSubtitleClass =
  "mt-1 text-xs font-normal leading-snug text-foreground/90"

/** Primary price emphasis on homepage tiles. */
export const homePeerTilePriceClass =
  "text-lg font-bold tabular-nums tracking-tight text-foreground"

export const homeListingScrollLinkClass = "min-w-0 flex flex-1 flex-col min-h-0"
export const homeListingScrollBodyClass = "min-w-0 p-3 flex flex-col flex-1 min-h-0"
export const homeListingScrollTitleSlotClass =
  "flex min-h-0 flex-1 flex-col overflow-hidden"
export const homeListingScrollHeadingClass = cn(
  listingTileTitleHeadingClassName,
  "line-clamp-4 break-words sm:line-clamp-3",
)
export const homeListingScrollMetaFooterClass = "w-full shrink-0 pt-1"

/** Same peer tile as homepage scroll rows, for responsive grids (e.g. listing detail “more from seller”). */
export const homePeerListingGridCardClass = cn(
  listingProductCardGridClassName,
  "min-w-0 h-full",
)

export const homePeerListingGridImageSizes =
  "(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 20vw"
