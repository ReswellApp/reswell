import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardSalesLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading sales">
      <div className="hidden space-y-2 border-b border-border/80 pb-5 lg:block">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64 bg-muted/70" />
      </div>
      <Skeleton className="h-7 w-24" />
      <Skeleton className="h-12 w-full rounded-full" />
      <Skeleton className="h-10 w-full max-w-md" />
      <div>
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex gap-4 border-b border-border/80 py-6 sm:gap-5">
            <Skeleton className="h-[72px] w-[72px] shrink-0 rounded-lg sm:h-20 sm:w-20" />
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-28 bg-muted/70" />
                <Skeleton className="h-4 w-20 bg-muted/70" />
                <Skeleton className="h-5 w-36" />
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-4 w-40 bg-muted/70" />
                <Skeleton className="h-4 w-28 bg-muted/70" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
