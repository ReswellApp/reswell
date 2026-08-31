import { Children, isValidElement, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { homeUniformScrollCarouselTileWrapClass } from "@/lib/home-listing-scroll-styles"

/**
 * Class names for the outer overflow element — shared with `TrendingBrandsStrip` for the same
 * full-bleed, hidden-scrollbar horizontal scroll. Callers set `pl-*` / any optional arrow insets.
 */
export const homeHorizontalScrollOuterClassName =
  "-mx-4 scroll-smooth overscroll-x-contain overflow-x-auto overflow-y-visible pb-2 sm:-mx-6 lg:-mx-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"

/** Default leading inset (matches the container’s horizontal padding). */
export const homeHorizontalScrollPlDefault = "pl-4 sm:pl-6 lg:pl-8"

/**
 * Full-bleed horizontal strip inside a padded container (e.g. PDP “recent” rows).
 * Prefer this over `100vw` + `translateX(-50%)`, which drifts past the viewport on mobile.
 */
export const listingDetailHorizontalStripBleedClassName =
  "-mx-4 w-[calc(100%+2rem)] min-w-0 sm:-mx-6 sm:w-[calc(100%+3rem)] lg:-mx-8 lg:w-[calc(100%+4rem)]"

/** Single-row horizontal scroll for homepage listing sections (up to 20 cards). */
export function HomeListingScrollRow({
  children,
  uniformCardHeights = true,
  tileWrapClassName = homeUniformScrollCarouselTileWrapClass,
  rowGapClassName = "gap-3",
  /** Keep the row inset in a padded band (city chapter strips) instead of full-bleed. */
  inset = false,
}: {
  children: ReactNode
  /** Stretch all cards to the row height (surfboards, PDP similar rows, shop strip). */
  uniformCardHeights?: boolean
  tileWrapClassName?: string
  rowGapClassName?: string
  inset?: boolean
}) {
  const inner = (
    <div
      className={cn(
        "flex w-max snap-x snap-proximity sm:snap-none",
        inset ? "pr-3 sm:pr-5" : "pr-4 sm:pr-6 lg:pr-8",
        rowGapClassName,
        uniformCardHeights && "min-h-0 items-stretch",
      )}
    >
      {uniformCardHeights
        ? Children.map(children, (child, index) => (
            <div
              key={isValidElement(child) && child.key != null ? child.key : index}
              className={tileWrapClassName}
            >
              {child}
            </div>
          ))
        : children}
    </div>
  )

  return (
    <div
      className={cn(
        inset
          ? "scroll-smooth overscroll-x-contain overflow-x-auto overflow-y-visible pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pl-3 sm:pl-5"
          : cn(homeHorizontalScrollOuterClassName, homeHorizontalScrollPlDefault),
      )}
    >
      {inner}
    </div>
  )
}
