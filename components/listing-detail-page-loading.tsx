import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { RouteTransitionMark } from "@/components/route-transition-mark"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Listing-shaped skeleton for App Router `loading.tsx` under `/l/*` (and anywhere else
 * we want the next screen to resemble `SurfboardListingDetailPage` instead of the logo mark).
 */
export function ListingDetailRouteSkeleton() {
  return (
    <main
      className="flex-1 w-full min-w-0 max-w-full overflow-x-clip py-8"
      role="status"
      aria-busy="true"
      aria-label="Loading listing"
    >
      <div className="container mx-auto w-full min-w-0 max-w-full">
        <div className="mb-6 min-w-0 max-w-full border-t border-neutral-200 pt-4">
          <Skeleton className="h-4 w-64 max-w-[85%]" />
        </div>

        <div className="mb-2 flex min-w-0 max-w-full items-start justify-between gap-3 lg:hidden">
          <Skeleton className="h-7 min-h-[1.75rem] flex-1 max-w-xl" />
          <Skeleton className="h-9 w-24 shrink-0 rounded-lg" />
        </div>
        <div className="mb-4 min-w-0 max-w-full space-y-2 lg:hidden">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </div>

        <div className="mx-auto grid w-full min-w-0 max-w-5xl gap-8 lg:grid-cols-2">
          <div className="min-w-0 space-y-3">
            <Skeleton className="aspect-[3/4] w-full rounded-xl" />
            <div className="flex gap-2 lg:hidden">
              <Skeleton className="h-12 flex-1 rounded-lg" />
              <Skeleton className="h-12 flex-1 rounded-lg" />
            </div>
          </div>
          <div className="min-w-0 space-y-4">
            <div className="hidden items-start justify-between gap-3 lg:flex">
              <Skeleton className="h-9 min-h-[2.25rem] flex-1 max-w-xl" />
              <Skeleton className="h-9 w-28 shrink-0 rounded-lg" />
            </div>
            <Skeleton className="hidden h-10 w-44 lg:block" />
            <Skeleton className="hidden h-4 w-full max-w-lg lg:block" />
            <Skeleton className="h-40 w-full rounded-xl sm:h-44" />
            <Skeleton className="h-36 w-full rounded-xl" />
            <Skeleton className="min-h-[6rem] w-full rounded-xl" />
          </div>
        </div>
      </div>
    </main>
  )
}

type SurfboardPageLoadingProps = {
  /**
   * When false, only the main loading strip is rendered (for segment layouts that
   * already include Header + Footer via `SiteChrome` in the root layout).
   */
  withShell?: boolean
}

export function SurfboardPageLoading({ withShell = true }: SurfboardPageLoadingProps = {}) {
  if (!withShell) {
    return <RouteTransitionMark variant="overlay" />
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <RouteTransitionMark variant="inline" />
      <Footer />
    </div>
  )
}

/** @deprecated Use SurfboardPageLoading */
export const ListingDetailPageLoading = SurfboardPageLoading
