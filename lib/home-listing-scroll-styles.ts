import { listingProductCardGridClassName } from "@/lib/listing-card-styles"
import { cn } from "@/lib/utils"

/** ~2 full cards + peek of 3rd on mobile; fixed width from `sm` up. */
export const homeListingScrollCardClass = cn(
  listingProductCardGridClassName,
  "shrink-0 snap-start w-[calc((100vw-1rem-2.25rem)/2.25)] sm:w-52",
)

/** Equal-height cards: surfboards rows, Browse by Category (fixed title band, flex stretch). */
export const homeUniformScrollCardClass = cn(
  listingProductCardGridClassName,
  "h-full min-h-0 shrink-0 snap-start self-stretch w-[calc((100vw-1rem-2.25rem)/2.25)] sm:w-52",
)

export const homeListingScrollImageSizes = "(max-width: 639px) 44vw, 208px"

export const homeUniformScrollLinkClass = "flex min-h-0 h-full min-w-0 flex-1 flex-col"
export const homeUniformScrollBodyClass = "flex min-h-0 min-w-0 flex-1 flex-col p-3 pt-3"
export const homeUniformScrollTitleSlotClass =
  "flex h-[6.25rem] max-h-[6.25rem] min-h-0 shrink-0 flex-col overflow-hidden sm:h-[5.75rem] sm:max-h-[5.75rem]"
export const homeUniformScrollMetaFooterClass = "mt-auto w-full shrink-0 pt-1"

export const homeListingScrollLinkClass = "min-w-0 flex flex-1 flex-col min-h-0"
export const homeListingScrollBodyClass = "min-w-0 p-3 flex flex-col flex-1 min-h-0"
export const homeListingScrollTitleSlotClass =
  "flex min-h-0 flex-1 flex-col overflow-hidden"
export const homeListingScrollHeadingClass =
  "text-sm font-medium leading-snug line-clamp-4 break-words sm:line-clamp-3"
export const homeListingScrollMetaFooterClass = "w-full shrink-0 pt-1"

/** Same peer tile as homepage scroll rows, for responsive grids (e.g. listing detail “more from seller”). */
export const homePeerListingGridCardClass = cn(
  listingProductCardGridClassName,
  "min-w-0 h-full",
)

export const homePeerListingGridImageSizes =
  "(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 20vw"
