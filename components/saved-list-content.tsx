'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Heart, MapPin } from 'lucide-react'
import { VerifiedBadge } from '@/components/verified-badge'
import {
  capitalizeWords,
  formatListingTileCategoryPillText,
  getPublicSellerDisplayName,
} from '@/lib/listing-labels'
import { ListingTile } from '@/components/listing-tile'
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

            const href = getListingHref(listing)
            const locationText =
              listing.city && listing.state
                ? `${listing.city}, ${listing.state}`
                : 'Location not set'
            const boardLength =
              listing.length_feet != null && listing.length_inches != null
                ? `${listing.length_feet}'${listing.length_inches}"`
                : listing.length_feet != null
                  ? `${listing.length_feet}'`
                  : null

            return (
              <ListingTile
                key={favorite.id}
                href={href}
                listingId={listing.id}
                title={capitalizeWords(listing.title)}
                imageAlt={capitalizeWords(listing.title)}
                listingImages={listing.listing_images}
                price={Number(listing.price)}
                linkLayout="unified"
                useBlurPlaceholder={false}
                cardClassName={listingProductCardGridClassName}
                cardContentClassName="min-w-0 p-3"
                soldOverlay={listing.status === 'sold'}
                subtitle={
                  listing.section === 'surfboards' && boardLength ? (
                    <p className="text-xs text-muted-foreground mt-0.5">{boardLength}</p>
                  ) : null
                }
                favorites={{
                  initialFavorited: true,
                  isLoggedIn: true,
                  onFavoritedChange: (favorited) => {
                    if (!favorited) handleRemoveFromList(listing.id)
                  },
                }}
                afterPriceSlot={
                  <>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      {getPublicSellerDisplayName(listing.profiles)}
                      {listing.profiles?.shop_verified && <VerifiedBadge size="sm" />}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {locationText}
                    </div>
                  </>
                }
                categoryPill={
                  formatListingTileCategoryPillText(listing) ?? getSectionLabel(listing.section)
                }
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
