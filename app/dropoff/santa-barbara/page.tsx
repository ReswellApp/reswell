import { SantaBarbaraDropoffLanding } from "@/components/features/dropoff/santa-barbara-dropoff-landing"
import type { SantaBarbaraShippedBoard } from "@/components/features/dropoff/santa-barbara-shipped-boards-slider"
import { getCachedMarketplaceSoldFeed } from "@/lib/cache/marketplace-sold-feed"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"
import { PageStructuredData } from "@/components/seo/page-structured-data"

export const revalidate = 3600

export async function generateMetadata() {
  return resolvePageMetadata("dropoff-santa-barbara")
}

function toShippedBoards(
  listings: Awaited<ReturnType<typeof getCachedMarketplaceSoldFeed>>["soldListings"],
): SantaBarbaraShippedBoard[] {
  return listings.slice(0, 12).map((listing) => ({
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    soldPrice: listing.soldPrice,
    condition: listing.condition,
    section: listing.section,
    soldAt: listing.sold_at,
    listingImages: listing.listing_images ?? null,
  }))
}

export default async function SantaBarbaraDropoffPage() {
  const shipped = await getCachedMarketplaceSoldFeed(null, true)

  return (
    <>
      <PageStructuredData pageKey="dropoff-santa-barbara" />
      <SantaBarbaraDropoffLanding shippedBoards={toShippedBoards(shipped.soldListings)} />
    </>
  )
}
