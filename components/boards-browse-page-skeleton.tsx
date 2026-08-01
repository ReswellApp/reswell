import { ListingTileGridSkeleton } from "@/components/listing-tile-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

/** Filter toolbar + results skeleton while facet counts load on `/boards`. */
export function BoardsBrowseFiltersSectionSkeleton({
  showTitle = true,
}: {
  showTitle?: boolean
}) {
  return (
    <>
      <div className="w-full min-w-0 border-b border-neutral-200/90 pb-5">
        {showTitle ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <div className="min-w-0 max-w-2xl space-y-2">
              <Skeleton className="h-9 w-48 max-w-[70%]" />
              <Skeleton className="h-4 w-full max-w-md" />
              <Skeleton className="h-4 w-3/4 max-w-sm" />
            </div>
            <Skeleton className="h-10 w-24 shrink-0 rounded-full" />
          </div>
        ) : (
          <Skeleton className="h-10 w-24 rounded-full" />
        )}
      </div>
      <div className="mt-5">
        <ListingTileGridSkeleton count={10} ariaLabel="Loading surfboards" />
      </div>
    </>
  )
}

/** Route-level skeleton for `/boards` — breadcrumb, header, and listing grid placeholders. */
export function BoardsBrowsePageSkeleton() {
  return (
    <main className="flex-1" role="status" aria-busy="true" aria-label="Loading surfboards">
      <section className="bg-offwhite pt-1 sm:pt-2 lg:pt-6">
        <div className="container mx-auto">
          <div className="border-t border-neutral-200 pt-2 lg:pt-3">
            <Skeleton className="h-4 w-48 max-w-[85%]" />
          </div>
        </div>
      </section>

      <section className="min-w-0 bg-offwhite pt-4 pb-4 sm:pt-5">
        <div className="container mx-auto min-w-0">
          <BoardsBrowseFiltersSectionSkeleton />
        </div>
      </section>
    </main>
  )
}
