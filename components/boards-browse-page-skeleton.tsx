import { ListingTileGridSkeleton } from "@/components/listing-tile-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

/** Filter toolbar + results skeleton while facet counts load on `/boards`. */
export function BoardsBrowseFiltersSectionSkeleton() {
  return (
    <>
      <div className="border-b pb-4 w-full min-w-0 px-1 sm:px-2">
        <Skeleton className="h-10 w-full max-w-3xl" />
        <div className="mt-3 flex flex-wrap gap-2">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      </div>
      <div className="mt-4 px-1 sm:px-2">
        <ListingTileGridSkeleton count={10} ariaLabel="Loading surfboards" />
      </div>
    </>
  )
}

/** Route-level skeleton for `/boards` — hero, filters, and listing grid placeholders. */
export function BoardsBrowsePageSkeleton() {
  return (
    <main className="flex-1" role="status" aria-busy="true" aria-label="Loading surfboards">
      <section className="bg-offwhite pt-6 pb-4 sm:pt-8 sm:pb-5">
        <div className="container mx-auto">
          <div className="border-t border-neutral-200 mb-4 pt-4">
            <Skeleton className="h-4 w-48 max-w-[85%]" />
          </div>
          <Skeleton className="mx-auto h-9 w-56 max-w-[70%]" />
          <Skeleton className="mx-auto mt-2 h-4 w-96 max-w-[90%]" />
        </div>
      </section>

      <section className="pt-2 pb-4 min-w-0">
        <div className="container mx-auto min-w-0">
          <BoardsBrowseFiltersSectionSkeleton />
        </div>
      </section>
    </main>
  )
}
