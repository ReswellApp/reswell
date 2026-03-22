import { Skeleton } from "@/components/ui/skeleton"

/**
 * Placeholder for async dashboard pages. Renders only the main column — the
 * dashboard layout already provides header, sidebar, and footer.
 */
export function DashboardMainSkeleton() {
  return (
    <div className="space-y-8" aria-busy aria-label="Loading dashboard">
      <div className="space-y-2">
        <Skeleton className="h-8 w-[min(100%,280px)]" />
        <Skeleton className="h-4 w-[min(100%,360px)]" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/60 bg-card p-6 shadow-sm"
          >
            <Skeleton className="mb-3 h-3 w-24" />
            <Skeleton className="h-9 w-20" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="flex flex-row items-center justify-between border-b border-border/60 px-6 py-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="border-b border-border/60 px-6 py-4">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
