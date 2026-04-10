import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

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
    <div className="-mx-4 overflow-x-auto overflow-y-visible pb-2 pl-4 sm:-mx-6 sm:pl-6 lg:-mx-8 lg:pl-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
