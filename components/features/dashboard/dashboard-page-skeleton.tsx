import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * Main-column placeholder while a dashboard route segment is loading.
 * Kept consistent across all `/dashboard/*` `loading.tsx` files (no Reswell mark flash).
 */
export function DashboardPageSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("space-y-6", className)}
      role="status"
      aria-label="Loading"
    >
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full max-w-lg bg-muted/70" />
      </div>
      <div className="flex w-full gap-1 rounded-xl border border-border/70 bg-muted/50 p-1">
        <Skeleton className="h-10 flex-1 rounded-lg" />
        <Skeleton className="h-10 flex-1 rounded-lg bg-muted/60" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl sm:w-[220px]" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
          >
            <div className="flex flex-col sm:flex-row">
              <Skeleton className="mx-auto aspect-[3/4] w-full max-w-[13rem] shrink-0 rounded-none sm:mx-0 sm:w-36 lg:w-44" />
              <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
                <div className="mt-auto flex gap-2">
                  <Skeleton className="h-9 w-24 rounded-full" />
                  <Skeleton className="h-9 w-28 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
