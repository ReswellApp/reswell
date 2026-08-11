'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ListingTileGridSkeleton } from '@/components/listing-tile-skeleton'
import { Heart, MapPin } from 'lucide-react'
import { wideShimmer } from '@/lib/image-shimmer'
import emptyStateWave from '@/public/images/brand/empty-state-wave.jpg'
import { VerifiedBadge } from '@/components/verified-badge'
import { getPublicSellerDisplayName } from '@/lib/listing-labels'
import { isListingVisibleInSavedList } from '@/lib/listing-public-visibility'
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
          hidden_from_site,
          archived_at,
          city,
          state,
          condition,
          board_type,
          dimensions,
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
      const rows = (data as unknown as SavedFavorite[]).filter((favorite) => {
        const listing = favorite.listing
        if (!listing) return false
        return isListingVisibleInSavedList(listing)
      })
      setFavorites(rows)
    }
    setLoading(false)
  }

  function handleRemoveFromList(listingId: string) {
    setFavorites(prev => prev.filter(f => f.listing.id !== listingId))
  }

  return (
    <div>
      <div className="relative mb-6 h-40 w-full overflow-hidden rounded-2xl border border-border/60 sm:h-48">
        <Image
          src={emptyStateWave}
          alt=""
          fill
          priority
          sizes="(max-width: 1280px) 100vw, 1100px"
          className="object-cover object-[center_35%]"
          placeholder="blur"
          blurDataURL={wideShimmer}
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/35 to-black/15"
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-5 pt-10 sm:px-6 sm:pb-6">
          <h1 className="text-2xl font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)] sm:text-3xl">
            Favorites
          </h1>
          <p className="mt-1 text-sm text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.3)] sm:text-base">
            Your collection of favorite gear and boards
          </p>
        </div>
      </div>

      {loading ? (
        <ListingTileGridSkeleton count={6} footerTrailingLines={2} ariaLabel="Loading favorites" />
      ) : favorites.length === 0 ? (
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
