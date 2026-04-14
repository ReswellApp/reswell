"use client"

import { type ReactNode, useTransition, Suspense } from "react"
import { BoardsListingsFilters, boardTypes, boardConditions, boardSortOptions } from "@/components/boards-listings-filters"
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

type BoardsBrowseClientProps = {
  children: ReactNode
  initialQ?: string
  initialLocation?: string
  initialType?: string
  initialCondition?: string
  initialSort?: string
}

/**
 * Surfboards browse uses search-param navigations; Next.js `loading.tsx` only runs for segment
 * changes, so we reuse the same transition + Reswell mark while filters update the URL.
 */
export function BoardsBrowseClient({
  children,
  initialQ = "",
  initialLocation = "",
  initialType = "all",
  initialCondition = "all",
  initialSort = "newest",
}: BoardsBrowseClientProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <>
      <div className="border-b py-3 w-full min-w-0 px-1 sm:px-2">
        <div className="min-w-0 w-full max-w-full">
          <BoardsListingsFilters
            transitionStart={startTransition}
            initialQ={initialQ}
            initialLocation={initialLocation}
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
            ignore={["page", "lat", "lng", "radius", "minPrice", "maxPrice"]}
            quoteValues={["q"]}
            valuePrefixes={{ location: "Near " }}
            valueLookups={{
              type: TYPE_LABEL,
              condition: CONDITION_LABEL,
              sort: SORT_LABEL,
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
