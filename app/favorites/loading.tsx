import { ListingTileGridSkeleton } from "@/components/listing-tile-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function FavoritesLoading() {
  return (
    <main className="flex-1">
      <section className="container mx-auto py-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        <div className="mt-6">
          <ListingTileGridSkeleton
            count={6}
            footerTrailingLines={2}
            ariaLabel="Loading favorites"
          />
        </div>
      </section>
    </main>
  )
}
