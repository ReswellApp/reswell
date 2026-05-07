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
      className="flex-1 w-full bg-muted pt-8 pb-16 md:pb-20 lg:pb-24"
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
