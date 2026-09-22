import {
  HomeListingScrollRow,
  HomePeerListingScrollTile,
} from "@/components/features/home"
import type { ModelMarketplaceListing } from "@/lib/db/brand-listings"

export function ModelListingsStrip({
  heading,
  countLabel,
  listings,
  favoritedListingIds,
  viewerUserId,
  statusLabel,
}: {
  heading: string
  countLabel?: string
  listings: ModelMarketplaceListing[]
  favoritedListingIds: string[]
  viewerUserId: string | null
  statusLabel?: "sold"
}) {
  if (listings.length === 0) return null

  return (
    <section aria-label={heading}>
      <h2 className="text-xl font-bold tracking-tight text-foreground">{heading}</h2>
      {countLabel ? <p className="mt-1 text-sm text-muted-foreground">{countLabel}</p> : null}
      <div className="mt-4">
        <HomeListingScrollRow uniformCardHeights>
          {listings.map((listing) => (
            <HomePeerListingScrollTile
              key={listing.id}
              listing={{
                id: listing.id,
                slug: listing.slug,
                user_id: listing.user_id,
                title: listing.title,
                price: listing.price,
                compare_at_price: listing.compare_at_price,
                is_good_deal: listing.is_good_deal,
                status: listing.status ?? (statusLabel === "sold" ? "sold" : "active"),
                section: listing.section,
                local_pickup: listing.local_pickup,
                shipping_available: listing.shipping_available,
                listing_images: listing.listing_images,
                categories: listing.categories,
                board_type: listing.board_type,
                condition: listing.condition,
              }}
              userId={viewerUserId}
              isFavorited={favoritedListingIds.includes(listing.id)}
              statusLabel={statusLabel}
            />
          ))}
        </HomeListingScrollRow>
      </div>
    </section>
  )
}
