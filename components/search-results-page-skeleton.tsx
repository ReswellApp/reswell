import { ListingTileGridSkeleton } from "@/components/listing-tile-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export function SearchResultsPageSkeleton() {
  return (
    <main className="flex-1" role="status" aria-busy="true" aria-label="Loading search results">
      <section className="border-b border-border bg-background">
        <div className="container mx-auto flex flex-col gap-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6 md:py-6">
          <div className="min-w-0">
            <Skeleton className="h-8 w-64 max-w-[85%]" />
            <Skeleton className="mt-2 h-4 w-36 max-w-full" />
          </div>
          <Skeleton className="h-9 w-44 shrink-0" />
        </div>
      </section>
      <section className="container mx-auto py-8">
        <div className="mb-6 flex flex-wrap gap-2">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
        <ListingTileGridSkeleton count={12} ariaLabel="Loading search results" />
      </section>
    </main>
  )
}
