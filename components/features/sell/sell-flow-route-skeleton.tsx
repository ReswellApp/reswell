import { Skeleton } from "@/components/ui/skeleton"

/**
 * Placeholder while the listing editor hydrates — single centered column only.
 * Omitting a fake left rail avoids the “dashboard sidebar” look during transitions from `/l`.
 */
export function SellFlowFormColumnSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <div className={className}>
      <div className="mx-auto min-w-0 w-full max-w-2xl space-y-8 lg:max-w-3xl">
        <div className="space-y-3">
          <Skeleton className="h-7 w-2/3 max-w-sm" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <Skeleton className="h-52 w-full rounded-xl sm:h-60" />
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="min-h-[10rem] w-full rounded-xl" />
      </div>
    </div>
  )
}

/**
 * Full sell route placeholder while the segment streams — breadcrumb strip + form skeleton.
 */
export function SellFlowRouteSkeleton() {
  return (
    <main
      className="flex-1 w-full bg-slate-100 pt-8 pb-16 md:pb-20 lg:pb-24"
      role="status"
      aria-label="Loading listing editor"
    >
      <div className="container relative mx-auto max-w-2xl min-h-[50vh] lg:max-w-6xl">
        <div className="border-t border-neutral-200 pt-4 pb-8 mb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <Skeleton className="h-4 w-56 max-w-[80%] sm:w-72" />
            <Skeleton className="h-9 w-9 shrink-0 rounded-md sm:ml-auto" />
          </div>
        </div>

        <SellFlowFormColumnSkeleton />
      </div>
    </main>
  )
}

/**
 * Matches `/sell` type chooser layout so soft navigations do not flash the form editor skeleton.
 */
export function SellTypeChooserSkeleton() {
  return (
    <main
      className="flex-1 bg-offwhite"
      role="status"
      aria-label="Loading sell options"
    >
      <div className="container mx-auto max-w-lg px-4 py-12 sm:py-16">
        <div className="flex flex-col items-center gap-3 text-center">
          <Skeleton className="h-9 w-64 max-w-[90%] sm:h-10 sm:w-80" />
          <Skeleton className="h-4 w-52 max-w-[80%]" />
        </div>
        <div className="mt-10 space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl border border-border bg-background px-4 py-4 sm:px-5"
            >
              <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-44 max-w-full" />
              </div>
              <Skeleton className="h-5 w-5 shrink-0 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
