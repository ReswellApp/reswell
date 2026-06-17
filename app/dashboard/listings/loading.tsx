import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardListingsLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading listings">
      <div className="space-y-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-4 w-full max-w-md bg-muted/70" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[3.25rem] rounded-xl" />
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-11 flex-1 rounded-full" />
        <Skeleton className="h-11 w-full rounded-full sm:w-[220px]" />
      </div>
      <Skeleton className="h-4 w-24" />
      <div className="space-y-0 divide-y divide-border/80">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4 py-5">
            <Skeleton className="aspect-[3/4] w-20 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="hidden flex-col gap-2 md:flex">
              <Skeleton className="h-9 w-24 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
