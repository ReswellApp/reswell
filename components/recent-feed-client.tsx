"use client"

import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
import type { ListingImageForCard } from "@/lib/listing-image-display"

export interface RecentListing {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: number
  condition?: string | null
  section: string
  status?: string
  city?: string | null
  state?: string | null
  shipping_available?: boolean
  local_pickup?: boolean | null
  board_type?: string | null
  board_length?: string | null
  listing_images?: { url: string; is_primary?: boolean; thumbnail_url?: string | null }[] | null
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
  /** Sold strip: grayscale photo + “Sold” label (see `/sold`, seller profile past listings). */
  soldPresentation?: boolean
}

export function RecentFeedClient({
  listings,
  favoritedListingIds,
  isLoggedIn: _isLoggedIn,
  viewerUserId,
  emptyMessage,
  soldPresentation = false,
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
      {listings.map((listing) => (
        <HomePeerListingScrollTile
          key={listing.id}
          layout="grid"
          userId={viewerUserId}
          isFavorited={favoritedListingIds.includes(listing.id)}
          statusLabel={soldPresentation ? "sold" : undefined}
          imageGrayscale={soldPresentation}
          listing={{
            id: listing.id,
            slug: listing.slug,
            user_id: listing.user_id,
            title: listing.title,
            price: listing.price,
            status: listing.status ?? (soldPresentation ? "sold" : "active"),
            section: listing.section,
            local_pickup: listing.local_pickup,
            shipping_available: listing.shipping_available,
            listing_images: listing.listing_images as ListingImageForCard[] | null,
            categories: listing.categories,
            board_type: listing.board_type,
            condition: listing.condition && listing.condition.trim() !== "" ? listing.condition : null,
          }}
        />
      ))}
    </div>
  )
}
