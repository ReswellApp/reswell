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
}: {
  children: ReactNode
  /** Stretch all cards to the row height (surfboards, Browse by Category). */
  uniformCardHeights?: boolean
}) {
  return (
    <div className={cn(homeHorizontalScrollOuterClassName, homeHorizontalScrollPlDefault)}>
      <div
        className={cn(
          "flex w-max gap-3 pr-4 sm:pr-6 lg:pr-8 snap-x snap-proximity sm:snap-none",
          uniformCardHeights && "min-h-0 items-stretch",
        )}
      >
        {children}
      </div>
    </div>
  )
}
