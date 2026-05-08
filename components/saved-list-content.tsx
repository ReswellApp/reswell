'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
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
    city: string | null
    state: string | null
    condition?: string | null
    board_type?: string | null
    length_feet?: number | null
    length_inches?: number | null
    shipping_available?: boolean
    local_pickup?: boolean | null
    listing_images: { url: string; is_primary: boolean }[]
    profiles?: { display_name?: string | null; shop_verified?: boolean } | null
    categories?: { name?: string | null } | null
  }
}

export function SavedListContent() {
  const [favorites, setFavorites] = useState<SavedFavorite[]>([])
  const [loading, setLoading] = useState(true)
  const [viewerId, setViewerId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchFavorites()
  }, [])

  async function fetchFavorites() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    setViewerId(user.id)

    const { data, error } = await supabase
      .from('favorites')
      .select(`
        id,
        created_at,
        listing:listings(
          id,
          slug,
          user_id,
          title,
          price,
          status,
          section,
          city,
          state,
          condition,
          board_type,
          length_feet,
          length_inches,
          shipping_available,
          local_pickup,
          listing_images(url, is_primary),
          profiles!listings_user_id_fkey(display_name, shop_verified),
          categories(name)
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setFavorites(data as unknown as SavedFavorite[])
    }
    setLoading(false)
  }

  function handleRemoveFromList(listingId: string) {
    setFavorites(prev => prev.filter(f => f.listing.id !== listingId))
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Favorites</h1>
      <p className="text-muted-foreground mb-6">Your collection of favorite gear and boards</p>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="overflow-hidden animate-pulse">
              <div className="aspect-[3/4] w-full bg-muted" />
              <CardContent className="p-3 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-6 bg-muted rounded w-1/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : favorites.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No favorites yet</h3>
            <p className="text-muted-foreground mb-4">
              Items you favorite will appear here for easy access
            </p>
            <Link href="/gear">
              <Button>Browse Listings</Button>
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
