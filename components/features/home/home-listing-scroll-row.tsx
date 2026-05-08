import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Class names for the outer overflow element — shared with `TrendingBrandsStrip` for the same
 * full-bleed, hidden-scrollbar horizontal scroll. Callers set `pl-*` / any optional arrow insets.
 */
export const homeHorizontalScrollOuterClassName =
  "-mx-4 scroll-smooth overscroll-x-contain overflow-x-auto overflow-y-visible pb-2 sm:-mx-6 lg:-mx-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"

/** Default leading inset (matches the container’s horizontal padding). */
export const homeHorizontalScrollPlDefault = "pl-4 sm:pl-6 lg:pl-8"

/** Single-row horizontal scroll for homepage listing sections (up to 20 cards). */
export function HomeListingScrollRow({
  children,
  uniformCardHeights,
  viewportFullWidth,
}: {
  children: ReactNode
  /** Stretch all cards to the row height (surfboards, Browse by Category). */
  uniformCardHeights?: boolean
  /**
   * Break out to the browser width (e.g. PDP “boards you might like”) while keeping the same
   * edge padding as default rows.
   */
  viewportFullWidth?: boolean
}) {
  const inner = (
    <div
      className={cn(
        "flex w-max gap-3 pr-4 sm:pr-6 lg:pr-8 snap-x snap-proximity sm:snap-none",
        uniformCardHeights && "min-h-0 items-stretch",
      )}
    >
      {children}
    </div>
  )

  const scrollable = (
    <div
      className={cn(
        viewportFullWidth
          ? "w-full scroll-smooth overscroll-x-contain overflow-x-auto overflow-y-visible pb-2 pl-4 sm:pl-6 lg:pl-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : cn(homeHorizontalScrollOuterClassName, homeHorizontalScrollPlDefault),
      )}
    >
      {inner}
    </div>
  )

  if (viewportFullWidth) {
    return (
      <div className="relative left-1/2 w-[calc(100vw-1.25rem)] max-w-[calc(100vw-1.25rem)] -translate-x-1/2 sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] lg:w-[calc(100vw-2.5rem)] lg:max-w-[calc(100vw-2.5rem)]">
        {scrollable}
      </div>
    )
  }

  return scrollable
}
