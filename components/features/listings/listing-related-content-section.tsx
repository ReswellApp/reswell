import { ListingRelatedContentCarousel } from "@/components/features/listings/listing-related-content-carousel"
import { getCachedListingRelatedContent } from "@/lib/cache/listing-related-content"

const LISTING_DETAIL_CONTAINER_CLASS =
  "container mx-auto w-full min-w-0 max-w-full px-4 sm:px-6 lg:px-8 lg:!max-w-[min(100%,1320px)] xl:!max-w-[min(100%,1480px)] 2xl:!max-w-[min(100%,1680px)]"

export async function ListingRelatedContentSection({
  listingId,
  variant = "page",
}: {
  listingId: string
  variant?: "page" | "embedded"
}) {
  const items = await getCachedListingRelatedContent(listingId)
  if (items.length === 0) return null

  const carousel = <ListingRelatedContentCarousel items={items} />

  if (variant === "embedded") {
    return (
      <section
        aria-labelledby="listing-related-content"
        className="mt-10 min-w-0 w-full border-t border-neutral-200/90 pt-8 dark:border-neutral-700/70"
      >
        {carousel}
      </section>
    )
  }

  return (
    <section
      aria-labelledby="listing-related-content"
      className="relative -mt-8 bg-background pb-16 sm:-mt-12 sm:pb-24"
    >
      <div className={LISTING_DETAIL_CONTAINER_CLASS}>
        <div className="min-w-0 w-full border-t border-neutral-200/90 pt-12 dark:border-neutral-700/70">
          {carousel}
        </div>
      </div>
    </section>
  )
}
