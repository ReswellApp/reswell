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
      className="relative flex-1 w-full min-w-0 max-w-full overflow-x-clip bg-gradient-to-b from-muted/35 via-background to-background pt-8 pb-16 dark:from-muted/10 sm:pb-24"
      role="status"
      aria-busy="true"
      aria-label="Loading listing"
    >
      <div className="container mx-auto w-full min-w-0 max-w-full px-4 sm:px-6">
        <div className="mb-8 min-w-0 max-w-full pt-1">
          <Skeleton className="h-4 w-64 max-w-[85%]" />
        </div>

        <div className="mb-3 flex min-w-0 max-w-full items-start justify-between gap-4 lg:hidden">
          <Skeleton className="min-h-[2rem] flex-1 max-w-xl" />
          <Skeleton className="h-9 w-28 shrink-0 rounded-full" />
        </div>
        <div className="mb-10 min-w-0 max-w-full space-y-3 lg:hidden">
          <Skeleton className="h-9 w-44" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-28 rounded-full" />
          </div>
        </div>

        <div className="mx-auto grid w-full min-w-0 max-w-6xl gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="min-w-0 space-y-5">
            <Skeleton className="aspect-[3/4] w-full rounded-3xl" />
            <div className="flex gap-2 lg:hidden">
              <Skeleton className="h-12 flex-1 rounded-full" />
              <Skeleton className="h-12 flex-1 rounded-full" />
            </div>
          </div>
          <div className="min-w-0 space-y-7">
            <div className="hidden items-start justify-between gap-3 lg:flex">
              <Skeleton className="h-12 min-h-[3rem] flex-1 max-w-xl" />
              <Skeleton className="h-9 w-36 shrink-0 rounded-full" />
            </div>
            <Skeleton className="hidden h-12 w-52 lg:block" />
            <div className="hidden flex-wrap gap-2 lg:flex">
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-28 rounded-full" />
            </div>
            <Skeleton className="h-24 w-full rounded-3xl sm:h-[6.25rem]" />
            <Skeleton className="h-52 w-full rounded-3xl" />
            <Skeleton className="min-h-[10rem] w-full rounded-3xl" />
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
      <Header serverHeaderAuth={{ user: null, bootstrap: null }} />
      <RouteTransitionMark variant="inline" />
      <Footer />
    </div>
  )
}

/** @deprecated Use SurfboardPageLoading */
export const ListingDetailPageLoading = SurfboardPageLoading
