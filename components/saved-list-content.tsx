'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Heart, MapPin, Truck } from 'lucide-react'
import { VerifiedBadge } from '@/components/verified-badge'
import { FavoriteButtonCardOverlay } from '@/components/favorite-button-card-overlay'
import {
  capitalizeWords,
  formatCondition,
  formatCategory,
  formatBoardType,
  getPublicSellerDisplayName,
} from '@/lib/listing-labels'
import { listingProductCardGridClassName } from '@/lib/listing-card-styles'
import { toast } from 'sonner'

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
    listing_images: { url: string; is_primary: boolean }[]
    profiles?: { display_name?: string | null; shop_verified?: boolean } | null
    categories?: { name?: string | null } | null
  }
}

export function SavedListContent() {
  const [favorites, setFavorites] = useState<SavedFavorite[]>([])
  const [loading, setLoading] = useState(true)
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
          listing_images(url, is_primary),
          profiles(display_name, shop_verified),
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

  const getSectionLabel = (section: string) => {
    switch (section) {
      case 'used': return 'Used Gear'
      case 'new': return 'New Items'
      case 'surfboards': return 'Surfboards'
      default: return section
    }
  }

  const getListingHref = (listing: SavedFavorite['listing']) => {
    const id = listing.slug || listing.id
    switch (listing.section) {
      case 'used': return `/used/${id}`
      case 'new': return `/shop/${listing.id}`
      case 'surfboards': return `/boards/${id}`
      default: return `/used/${id}`
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Saved Items</h1>
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
            <h3 className="text-lg font-semibold text-foreground mb-2">No saved items</h3>
            <p className="text-muted-foreground mb-4">
              Items you save will appear here for easy access
            </p>
            <Link href="/used">
              <Button>Browse Listings</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {favorites.map((favorite) => {
            const listing = favorite.listing
            if (!listing) return null

            const primaryImage =
              listing.listing_images?.find(img => img.is_primary) || listing.listing_images?.[0]
            const href = getListingHref(listing)
            const locationText =
              listing.city && listing.state
                ? `${listing.city}, ${listing.state}`
                : 'Location not set'
            const isInPersonOnly = listing.section === 'surfboards' || !listing.shipping_available
            const boardLength =
              listing.length_feet != null && listing.length_inches != null
                ? `${listing.length_feet}'${listing.length_inches}"`
                : listing.length_feet != null
                  ? `${listing.length_feet}'`
                  : null

            return (
              <Card
                key={favorite.id}
                className={listingProductCardGridClassName}
              >
                <Link href={href} className="min-w-0 flex-1 flex flex-col">
                  <div className="aspect-[3/4] w-full relative bg-muted overflow-hidden">
                    {primaryImage?.url ? (
                      // CLS-FIX: sizes prevents browser choosing wrong resolution
                      <Image
                        src={primaryImage.url || '/placeholder.svg'}
                        alt={capitalizeWords(listing.title)}
                        fill
                        sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 20vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                        No Image
                      </div>
                    )}
                    <FavoriteButtonCardOverlay
                      listingId={listing.id}
                      initialFavorited
                      isLoggedIn
                      onFavoritedChange={(favorited) => {
                        if (!favorited) handleRemoveFromList(listing.id)
                      }}
                    />
                    {listing.status === 'sold' && (
                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                        <span className="text-sm font-semibold text-foreground">SOLD</span>
                      </div>
                    )}
                  </div>
                  <CardContent className="min-w-0 p-3">
                    <h3 className="text-sm font-medium line-clamp-2 min-h-[2.8em]">{capitalizeWords(listing.title)}</h3>
                    {listing.section === 'surfboards' && boardLength && (
                      <p className="text-xs text-muted-foreground mt-0.5">{boardLength}</p>
                    )}
                    <p className="text-base font-bold text-black dark:text-white mt-1">
                      ${Number(listing.price).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      {getPublicSellerDisplayName(listing.profiles)}
                      {listing.profiles?.shop_verified && <VerifiedBadge size="sm" />}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {locationText}
                    </div>
                    <div className="mt-1">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {getSectionLabel(listing.section)}
                      </Badge>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
