import { ListingTileGridSkeleton } from "@/components/listing-tile-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export function SearchResultsPageSkeleton() {
  return (
    <main className="flex-1" role="status" aria-busy="true" aria-label="Loading search results">
      <section className="border-b border-border bg-background">
        <div className="container mx-auto py-8">
          <Skeleton className="h-8 w-48 max-w-[85%]" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
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
