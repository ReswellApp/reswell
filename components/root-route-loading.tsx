"use client"

import { usePathname } from "next/navigation"
import { ListingDetailRouteSkeleton } from "@/components/listing-detail-page-loading"
import { RouteTransitionMark } from "@/components/route-transition-mark"
import { cn } from "@/lib/utils"

/**
 * Full-bleed placeholder while the App Router segment streams. For `/`, mirrors the home
 * hero + first listing row so a hard refresh feels like one layout resolving instead of
 * a logo swap into unrelated structure.
 */
function HomeLoadingSkeleton() {
  return (
    <div
      className={cn(
        "flex w-full flex-1 flex-col self-stretch bg-background",
        "h-full min-h-[calc(100dvh-12rem)] sm:min-h-[calc(100dvh-10rem)]",
      )}
      role="status"
      aria-label="Loading page"
    >
      <section className="relative min-h-[max(19.5rem,51svh)] overflow-hidden sm:min-h-[max(21.5rem,51svh)] md:min-h-[max(34rem,min(72svh,42rem))]">
        <div className="skeleton pointer-events-none absolute inset-0 z-0 !rounded-none" aria-hidden />
        <div className="container relative z-10 mx-auto flex min-h-[inherit] flex-col items-center justify-center px-4 py-12 text-center sm:py-14 md:py-32">
          <div className="skeleton mb-4 h-7 w-52 max-w-[90%] rounded-full sm:h-8 sm:w-64" />
          <div className="skeleton mb-3 hidden h-[3.25rem] w-full max-w-2xl md:block" />
          <div className="skeleton mb-3 h-10 w-full max-w-xl sm:h-11 md:hidden" />
          <div className="skeleton mb-3 h-10 w-full max-w-lg sm:h-11 md:hidden" />
          <div className="skeleton mb-8 h-5 w-full max-w-md" />
          <div className="flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center sm:gap-4">
            <div className="skeleton h-11 w-full rounded-md sm:w-44" />
            <div className="skeleton h-11 w-full rounded-md sm:w-36" />
          </div>
        </div>
      </section>
      <div className="container mx-auto px-4 py-12 sm:py-16">
        <div className="skeleton mb-8 h-9 w-72 max-w-[85%]" />
        <div className="flex gap-3 overflow-hidden pb-1 sm:gap-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="w-[42vw] shrink-0 sm:w-40 md:w-44">
              <div className="skeleton aspect-[3/4] w-full !rounded-xl" />
              <div className="skeleton mt-3 h-4 w-full" />
              <div className="skeleton mt-2 h-4 w-[70%]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function RootRouteLoading() {
  const pathname = usePathname()
  if (pathname === "/") {
    return <HomeLoadingSkeleton />
  }
  if (pathname?.startsWith("/l/")) {
    return <ListingDetailRouteSkeleton />
  }
  return <RouteTransitionMark variant="overlay" />
}
