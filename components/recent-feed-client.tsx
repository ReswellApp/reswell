"use client"

import { capitalizeWords, formatListingTileCategoryPillText } from "@/lib/listing-labels"
import { ListingTile } from "@/components/listing-tile"
import { listingProductCardGridClassName } from "@/lib/listing-card-styles"
import { listingDetailHref } from "@/lib/listing-href"
import { computePeerCartPriceAction } from "@/lib/peer-listing-cart"

export interface RecentListing {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: number
  condition: string
  section: string
  status?: string
  city?: string | null
  state?: string | null
  shipping_available?: boolean
  local_pickup?: boolean | null
  board_type?: string | null
  board_length?: string | null
  listing_images?: { url: string; is_primary?: boolean }[] | null
  profiles?: { display_name?: string | null; avatar_url?: string | null; location?: string | null; sales_count?: number; shop_verified?: boolean } | null
  categories?: { name?: string | null; slug?: string | null } | null
}

interface RecentFeedClientProps {
  listings: RecentListing[]
  favoritedListingIds: string[]
  isLoggedIn: boolean
  viewerUserId: string | null
  /** Override default empty state copy (e.g. search results). */
  emptyMessage?: string
}

function getListingHref(listing: RecentListing): string {
  return listingDetailHref({
    section: listing.section,
    slug: listing.slug,
    id: listing.id,
  })
}

export function RecentFeedClient({
  listings,
  favoritedListingIds,
  isLoggedIn,
  viewerUserId,
  emptyMessage,
}: RecentFeedClientProps) {
  if (!listings.length) {
    return (
      <p className="text-center text-muted-foreground py-12">
        {emptyMessage ?? "No recent listings yet. Check back soon."}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {listings.map((listing) => {
        const href = getListingHref(listing)
        const locationText =
          listing.city && listing.state
            ? `${listing.city}, ${listing.state}`
            : listing.profiles?.location || "Location not set"
        const cartAction = computePeerCartPriceAction(viewerUserId, {
          id: listing.id,
          user_id: listing.user_id,
          section: listing.section,
          status: listing.status ?? "active",
          local_pickup: listing.local_pickup,
          shipping_available: listing.shipping_available,
        })
        return (
          <ListingTile
            key={listing.id}
            href={href}
            listingId={listing.id}
            title={capitalizeWords(listing.title)}
            imageAlt={capitalizeWords(listing.title)}
            listingImages={listing.listing_images ?? null}
            price={listing.price}
            linkLayout="unified"
            useBlurPlaceholder={false}
            cardClassName={listingProductCardGridClassName}
            cardContentClassName="min-w-0 p-3"
            subtitle={
              listing.section === "surfboards" && listing.board_length ? (
                <p className="text-sm text-muted-foreground mt-1">{listing.board_length}</p>
              ) : null
            }
            meta={{ variant: "location", text: locationText }}
            categoryPill={formatListingTileCategoryPillText(listing)}
            priceAction={cartAction}
            favorites={{
              initialFavorited: favoritedListingIds.includes(listing.id),
              isLoggedIn,
            }}
          />
        )
      })}
    </div>
  )
}
