"use client"

import { type ReactNode, useTransition } from "react"
import { BoardsListingsFilters } from "@/components/boards-listings-filters"
import { RouteTransitionMark } from "@/components/route-transition-mark"
import { cn } from "@/lib/utils"

type BoardsBrowseClientProps = {
  children: ReactNode
  initialQ?: string
  initialLocation?: string
  initialType?: string
  initialCondition?: string
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
}: BoardsBrowseClientProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <>
      <div className="border-b py-4 mb-6 min-w-0 overflow-x-auto overflow-y-hidden px-1 sm:px-2">
        <div className="min-w-0">
          <BoardsListingsFilters
            transitionStart={startTransition}
            initialQ={initialQ}
            initialLocation={initialLocation}
            initialType={initialType}
            initialCondition={initialCondition}
          />
        </div>
      </div>

      <div
        className={cn("relative", isPending && "min-h-[min(50vh,28rem)]")}
        aria-busy={isPending}
      >
        {isPending ? (
          <div
            className="absolute inset-0 z-20 flex items-stretch justify-center bg-white/90 backdrop-blur-[0.5px]"
            aria-hidden
          >
            <RouteTransitionMark variant="overlay" />
          </div>
        ) : null}
        {children}
      </div>
    </>
  )
}
