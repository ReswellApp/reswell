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
      <div className="flex h-12 max-w-lg gap-1 rounded-xl bg-muted/80 p-1">
        <Skeleton className="h-full min-h-0 flex-1 rounded-lg" />
        <Skeleton className="h-full min-h-0 flex-1 rounded-lg bg-muted/60" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
