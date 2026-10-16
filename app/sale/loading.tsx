import { ListingTileGridSkeleton } from "@/components/listing-tile-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function SaleLoading() {
  return (
    <main className="flex-1">
      <section className="border-b border-border bg-background">
        <div className="container mx-auto py-8">
          <Skeleton className="h-8 w-40 max-w-[85%]" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        </div>
      </section>
      <section className="container mx-auto py-6">
        <ListingTileGridSkeleton count={10} ariaLabel="Loading sale listings" />
      </section>
    </main>
  )
}
