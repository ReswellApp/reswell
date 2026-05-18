"use client"

import { type ReactNode, Suspense, useTransition } from "react"
import {
  BoardsListingsFilters,
  boardRadiusOptions,
  boardTypes,
  boardConditions,
  boardSortOptions,
} from "@/components/boards-listings-filters"
import { BOARDS_BROWSE_DEFAULT_SORT } from "@/lib/marketplace-slug-metadata"
import { ActiveFilterChips } from "@/components/active-filter-chips"
import { cn } from "@/lib/utils"

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  boardTypes.map((t) => [t.value, t.label]),
)
const CONDITION_LABEL: Record<string, string> = Object.fromEntries(
  boardConditions.map((c) => [c.value, c.label]),
)
const SORT_LABEL: Record<string, string> = Object.fromEntries(
  boardSortOptions.map((s) => [s.value, s.label]),
)
const RADIUS_LABEL: Record<string, string> = Object.fromEntries(
  boardRadiusOptions.filter((r) => r.value !== "any").map((r) => [r.value, r.label]),
)

type BoardsBrowseClientProps = {
  children: ReactNode
  initialQ?: string
  initialBrand?: string
  initialModel?: string
  initialBrandId?: string
  initialBrandModelId?: string
  initialDimensions?: string
  initialMinPrice?: string
  initialMaxPrice?: string
  initialLocation?: string
  initialRadius?: string
  initialType?: string
  initialCondition?: string
  initialSort?: string
}

/**
 * Surfboards browse uses search-param navigations; reuse transition + opacity while filters update the URL.
 */
export function BoardsBrowseClient({
  children,
  initialQ = "",
  initialBrand = "",
  initialModel = "",
  initialBrandId = "",
  initialBrandModelId = "",
  initialDimensions = "",
  initialMinPrice = "",
  initialMaxPrice = "",
  initialLocation = "",
  initialRadius = "",
  initialType = "all",
  initialCondition = "all",
  initialSort = BOARDS_BROWSE_DEFAULT_SORT,
}: BoardsBrowseClientProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <>
      <div className="border-b py-3 w-full min-w-0 px-1 sm:px-2">
        <div className="min-w-0 w-full max-w-full">
          <BoardsListingsFilters
            transitionStart={startTransition}
            initialQ={initialQ}
            initialBrand={initialBrand}
            initialModel={initialModel}
            initialBrandId={initialBrandId}
            initialBrandModelId={initialBrandModelId}
            initialDimensions={initialDimensions}
            initialMinPrice={initialMinPrice}
            initialMaxPrice={initialMaxPrice}
            initialLocation={initialLocation}
            initialRadius={initialRadius}
            initialType={initialType}
            initialCondition={initialCondition}
            initialSort={initialSort}
          />
        </div>
      </div>

      <Suspense fallback={null}>
        <div className="px-1 sm:px-2 pt-3 pb-1 min-h-[2rem]">
          <ActiveFilterChips
            clearHref="/boards"
            ignore={["page", "lat", "lng", "brandId", "brandModelId"]}
            quoteValues={["q"]}
            valuePrefixes={{
              location: "Near ",
              minPrice: "Min $",
              maxPrice: "Max $",
              brand: "Brand ",
              model: "Model ",
              dimensions: "Dims ",
            }}
            valueLookups={{
              type: TYPE_LABEL,
              condition: CONDITION_LABEL,
              sort: SORT_LABEL,
              radius: RADIUS_LABEL,
            }}
          />
        </div>
      </Suspense>

      <div
        className={cn(
          "relative mt-4 transition-[opacity] duration-300 ease-out motion-reduce:transition-none",
          isPending && "opacity-[0.97]",
        )}
        aria-busy={isPending}
      >
        {children}
      </div>
    </>
  )
}
