'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Heart, MapPin } from 'lucide-react'
import { VerifiedBadge } from '@/components/verified-badge'
import { getPublicSellerDisplayName } from '@/lib/listing-labels'
import { HomePeerListingScrollTile } from '@/components/features/home/home-peer-listing-scroll-tile'
import type { ListingImageForCard } from '@/lib/listing-image-display'

export interface SavedFavorite {
  id: string
  created_at: string
  listing: {
    id: string
    slug: string | null
    user_id: string
    title: string
    price: number
    status: string
    section: string
    hidden_from_site?: boolean | null
    archived_at?: string | null
    city: string | null
    state: string | null
    condition?: string | null
    board_type?: string | null
    dimensions?: string | null
    shipping_available?: boolean | null
    local_pickup?: boolean | null
    listing_images: { url: string; is_primary: boolean }[]
    profiles?: { display_name?: string | null; shop_verified?: boolean } | null
    categories?: { name?: string | null } | null
  }
}

export function SavedListContent({
  viewerId,
  initialFavorites,
}: {
  viewerId: string
  initialFavorites: SavedFavorite[]
}) {
  const [favorites, setFavorites] = useState<SavedFavorite[]>(initialFavorites)

  useEffect(() => {
    setFavorites(initialFavorites)
  }, [initialFavorites])

  function handleRemoveFromList(listingId: string) {
    setFavorites((prev) => prev.filter((f) => f.listing.id !== listingId))
  }

  return (
    <div>
      {favorites.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center sm:p-10">
            <Heart className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold text-foreground">No favorites yet</h3>
            <p className="mb-5 text-muted-foreground">
              Save boards you love — they&apos;ll wait here for your next session.
            </p>
            <Link href="/boards">
              <Button>Browse boards</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {favorites.map((favorite) => {
            const listing = favorite.listing
            if (!listing) return null

            const locationText =
              listing.city && listing.state
                ? `${listing.city}, ${listing.state}`
                : 'Location not set'

            return (
              <HomePeerListingScrollTile
                key={favorite.id}
                layout="grid"
                userId={viewerId}
                isFavorited
                soldOverlay={listing.status === 'sold'}
                listing={{
                  id: listing.id,
                  slug: listing.slug,
                  user_id: listing.user_id,
                  title: listing.title,
                  price: listing.price,
                  status: listing.status,
                  section: listing.section,
                  local_pickup: listing.local_pickup,
                  shipping_available: listing.shipping_available,
                  listing_images: listing.listing_images as ListingImageForCard[],
                  categories: listing.categories,
                  board_type: listing.board_type,
                  condition:
                    listing.condition && listing.condition.trim() !== ''
                      ? listing.condition
                      : null,
                }}
                onFavoritedChange={(favorited) => {
                  if (!favorited) handleRemoveFromList(listing.id)
                }}
                footerTrailing={
                  <>
                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                      {getPublicSellerDisplayName(listing.profiles)}
                      {listing.profiles?.shop_verified && <VerifiedBadge size="sm" />}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {locationText}
                    </div>
                  </>
                }
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
