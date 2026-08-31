import {
  listingProductCardClassName,
  listingProductCardGridClassName,
  listingTileTitleHeadingClassName,
} from "@/lib/listing-card-styles"
import { cn } from "@/lib/utils"

/** Fixed width for one homepage scroll tile (`sm:w-52` = 13rem). */
export const homeScrollTileSmWidthClass = "sm:w-52"

/**
 * Mobile tile width — use `svw` (small viewport) instead of `vw` so rows don’t exceed
 * the paintable layout on iOS / mobile Chrome (raw `100vw` often includes UI chrome).
 */
const homeScrollTileMobileWidthClass =
  `w-[calc((100svw-1rem-2.25rem)/2.25)] ${homeScrollTileSmWidthClass}`

/** ~2 full cards + peek of 3rd on mobile; fixed width from `sm` up. */
export const homeListingScrollCardClass = cn(
  listingProductCardGridClassName,
  "shrink-0 snap-start",
  homeScrollTileMobileWidthClass,
)

/** Equal-height carousel columns: stretch wrapper + flex-1 card (see `HomeListingScrollRow`). */
export const homeUniformScrollCarouselTileWrapClass = cn(
  "flex min-h-0 shrink-0 snap-start self-stretch flex-col",
  homeScrollTileMobileWidthClass,
)

/** Fills {@link homeUniformScrollCarouselTileWrapClass} — {@link listingProductCardClassName} + column stretch. */
export const homeUniformScrollCardClass = cn(
  listingProductCardClassName,
  "flex min-h-0 min-w-0 w-full flex-1 flex-col",
)

export const homeListingScrollImageSizes = "(max-width: 639px) 40svw, 208px"

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

/** Uniform 3×3 most-viewed mosaic — hero is the same tile size as the ring (center cell). */
export const homeMostViewedMosaicDesktopGridClass =
  "mx-auto hidden w-fit max-w-full grid-cols-3 items-start gap-2 sm:grid sm:[grid-template-columns:repeat(3,10rem)]"

/** Compact most-viewed tiles — narrower than homepage scroll rows (`sm:w-40` vs `sm:w-52`). */
export const homeMostViewedCompactTileWrapClass = cn(
  "flex min-h-0 shrink-0 snap-start self-stretch flex-col",
  "w-[calc((100svw-1rem-2rem)/2.2)] sm:w-40",
)

/** City landing top-listings strip — smaller than most-viewed compact on mobile (~2.8 cards). */
export const cityTopListingTileWrapClass = cn(
  "flex min-h-0 shrink-0 snap-start self-stretch flex-col",
  "w-[calc((100svw-1rem-1.5rem)/2.85)] sm:w-40",
)

/**
 * City surf-shops / top-sellers strip — secondary to board tiles.
 * Narrower (~3.6 peeks on mobile, `sm:w-28`) so the board grid stays primary.
 */
export const cityEntityTileWrapClass = cn(
  "flex min-h-0 shrink-0 snap-start self-stretch flex-col",
  "w-[calc((100svw-1rem-1.25rem)/3.6)] sm:w-28",
)

export const cityEntityTileBodyClass =
  "flex min-h-0 min-w-0 flex-1 flex-col px-1.5 pb-1.5 pt-1"

export const cityEntityTileTitleClass = cn(
  listingTileTitleHeadingClassName,
  "text-[11px] font-semibold leading-snug tracking-tight text-foreground line-clamp-2 sm:text-xs",
)

export const cityEntityTileSubtitleClass =
  "mt-0.5 text-[10px] font-normal leading-snug text-foreground/90"

export const homeMostViewedCompactBodyClass =
  "flex min-h-0 min-w-0 flex-1 flex-col px-2 pb-2 pt-2"

export const homeMostViewedCompactTitleClass = cn(
  listingTileTitleHeadingClassName,
  "text-xs font-semibold leading-snug tracking-tight text-foreground line-clamp-2 sm:text-[13px]",
)

export const homeMostViewedCompactSubtitleClass =
  "mt-0.5 text-[11px] font-normal leading-snug text-foreground/90"

export const homeMostViewedCompactPriceClass =
  "text-sm font-bold tabular-nums tracking-tight text-foreground"

/** Fills one mosaic grid cell without fixed carousel width (prevents cell overflow). */
export const homeMostViewedMosaicCellWrapClass = "min-w-0 w-full max-w-full overflow-hidden"

/** Mobile fallback: hero on top, satellites in a 2-column compact grid. */
export const homeMostViewedMosaicMobileGridClass =
  "mx-auto grid w-fit max-w-full grid-cols-2 items-start gap-2 sm:hidden"
