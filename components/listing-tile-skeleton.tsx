import { Skeleton } from "@/components/ui/skeleton"
import {
  homePeerListingGridCardClass,
  homeUniformScrollBodyClass,
  homeUniformScrollCardClass,
  homeUniformScrollMetaFooterClass,
} from "@/lib/home-listing-scroll-styles"
import { cn } from "@/lib/utils"

const TITLE_WIDTHS = [
  "w-full max-w-[min(100%,14rem)]",
  "w-[88%]",
  "w-[92%]",
  "w-[80%]",
] as const

/** Mobile tile width — matches homepage horizontal listing rows. */
const homeScrollTileWrapClass =
  "w-[calc((100svw-1rem-2.25rem)/2.25)] shrink-0 sm:w-52"

export type ListingTileSkeletonLayout = "grid" | "homeScroll"

export interface ListingTileSkeletonProps {
  layout?: ListingTileSkeletonLayout
  /** Extra meta lines under price (e.g. favorites: seller + location). */
  footerTrailingLines?: 0 | 2
  className?: string
  index?: number
}

/** Skeleton placeholder matching {@link ListingTile} / peer marketplace tile layout. */
export function ListingTileSkeleton({
  layout = "grid",
  footerTrailingLines = 0,
  className,
  index = 0,
}: ListingTileSkeletonProps) {
  const cardClass =
    layout === "grid" ? homePeerListingGridCardClass : homeUniformScrollCardClass
  const titleWidth = TITLE_WIDTHS[index % TITLE_WIDTHS.length]

  return (
    <div className={cn(cardClass, className)} aria-hidden>
      <Skeleton className="aspect-[3/4] w-full shrink-0 rounded-none" />
      <div className={cn(homeUniformScrollBodyClass, "gap-1.5")}>
        <Skeleton className={cn("h-4", titleWidth)} />
        <Skeleton className="h-3 w-24" />
        <div className={homeUniformScrollMetaFooterClass}>
          <div className="flex min-w-0 items-center justify-between gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
          </div>
          {footerTrailingLines >= 2 ? (
            <>
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-36" />
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export interface ListingTileGridSkeletonProps {
  count?: number
  footerTrailingLines?: 0 | 2
  className?: string
  ariaLabel?: string
}

/** Responsive listing grid skeleton — matches boards browse, search, favorites, sold feeds. */
export function ListingTileGridSkeleton({
  count = 10,
  footerTrailingLines = 0,
  className,
  ariaLabel = "Loading listings",
}: ListingTileGridSkeletonProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
        className,
      )}
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
    >
      {Array.from({ length: count }, (_, i) => (
        <ListingTileSkeleton
          key={i}
          layout="grid"
          index={i}
          footerTrailingLines={footerTrailingLines}
        />
      ))}
    </div>
  )
}

export interface ListingTileScrollRowSkeletonProps {
  count?: number
  className?: string
  tileWrapClassName?: string
}

/** Horizontal listing row skeleton — homepage peer scroll bands. */
export function ListingTileScrollRowSkeleton({
  count = 8,
  className,
  tileWrapClassName = homeScrollTileWrapClass,
}: ListingTileScrollRowSkeletonProps) {
  return (
    <div
      className={cn("flex gap-3 overflow-hidden pb-1 sm:gap-4", className)}
      aria-hidden
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={tileWrapClassName}>
          <ListingTileSkeleton layout="homeScroll" index={i} />
        </div>
      ))}
    </div>
  )
}
