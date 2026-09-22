import { ListingTileShimmer } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const SKELETON_CARD_KEYS = [0, 1, 2, 3, 4, 5] as const

const TITLE_WIDTHS = [
  "w-full max-w-[min(100%,10rem)]",
  "w-[88%]",
  "w-[92%]",
  "w-[80%]",
] as const

/** Skeleton placeholder matching {@link SellerDirectoryCard} storefront layout. */
export function SellerDirectoryCardSkeleton({ index = 0 }: { index?: number }) {
  const titleWidth = TITLE_WIDTHS[index % TITLE_WIDTHS.length]

  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
      aria-hidden
    >
      <div className="relative aspect-[4/3] w-full">
        <ListingTileShimmer className="h-full w-full rounded-none" />
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 px-2.5 pb-2">
          <ListingTileShimmer className="h-8 w-8 shrink-0 rounded-full" />
          <ListingTileShimmer className={cn("mb-1 h-3.5", titleWidth)} />
        </div>
      </div>
      <div className="px-2.5 py-2">
        <ListingTileShimmer className="h-3 w-28" />
      </div>
    </div>
  )
}

/** Full-route placeholder while `/sellers` streams — matches hero + directory card grid layout. */
export function SellersPageSkeleton() {
  return (
    <main className="flex-1" role="status" aria-busy="true" aria-label="Loading sellers directory">
      <section className="border-b border-border/60 bg-offwhite py-10 sm:py-12">
        <div className="container relative mx-auto px-4 sm:px-6">
          <ListingTileShimmer className="mb-6 h-4 w-40 max-w-[85%] sm:mb-8" />
          <div className="mx-auto max-w-3xl text-center">
            <ListingTileShimmer className="mx-auto h-10 w-[min(100%,18rem)] max-w-full sm:h-11" />
            <div className="mx-auto mt-3 flex max-w-2xl flex-col items-center gap-2">
              <ListingTileShimmer className="h-4 w-full max-w-xl" />
              <ListingTileShimmer className="h-4 w-full max-w-lg" />
            </div>
            <ListingTileShimmer className="mx-auto mt-7 h-11 w-full max-w-lg rounded-lg" />
          </div>
        </div>
      </section>
      <section className="py-10 sm:py-14" aria-hidden>
        <div className="container mx-auto px-4 sm:px-6">
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {SKELETON_CARD_KEYS.map((key) => (
              <li key={key} className="min-h-0">
                <SellerDirectoryCardSkeleton index={key} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}
