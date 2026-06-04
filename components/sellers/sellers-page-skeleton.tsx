import { ListingTileShimmer } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const SKELETON_CARD_KEYS = [0, 1, 2, 3, 4, 5] as const

const TITLE_WIDTHS = [
  "w-full max-w-[min(100%,10rem)]",
  "w-[88%]",
  "w-[92%]",
  "w-[80%]",
] as const

/** Skeleton placeholder matching {@link SellerDirectoryCard} layout. */
export function SellerDirectoryCardSkeleton({ index = 0 }: { index?: number }) {
  const titleWidth = TITLE_WIDTHS[index % TITLE_WIDTHS.length]

  return (
    <div
      className="overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
      aria-hidden
    >
      <ListingTileShimmer className="h-[152px] w-full rounded-none sm:h-[172px]" />
      <div className="flex items-start gap-3 px-4 pb-3 pt-3.5">
        <ListingTileShimmer className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2 pt-0.5">
          <ListingTileShimmer className={cn("h-4", titleWidth)} />
          <ListingTileShimmer className="h-3 w-16" />
        </div>
        <ListingTileShimmer className="h-9 w-[4.75rem] shrink-0 rounded-full" />
      </div>
      <div className="min-h-[4.75rem] space-y-2 px-4 pb-4 pt-0.5">
        <ListingTileShimmer className="h-4 w-32" />
        <ListingTileShimmer className="h-4 w-40" />
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
        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
