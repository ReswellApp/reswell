"use client"

import { capitalizeWords, formatListingTileCategoryPillText } from "@/lib/listing-labels"
import { ListingTile } from "@/components/listing-tile"
import { listingProductCardGridClassName } from "@/lib/listing-card-styles"

export interface RecentListing {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: number
  condition: string
  section: string
  city?: string | null
  state?: string | null
  shipping_available?: boolean
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
  /** Override default empty state copy (e.g. search results). */
  emptyMessage?: string
}

function getListingHref(listing: RecentListing): string {
  const id = listing.slug || listing.id
  switch (listing.section) {
    case "used":
      return `/used/${id}`
    case "surfboards":
      return `/boards/${id}`
    default:
      return `/used/${id}`
  }
}

export function RecentFeedClient({
  listings,
  favoritedListingIds,
  isLoggedIn,
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
