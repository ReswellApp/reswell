'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Heart, Trash2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

interface Favorite {
  id: string
  created_at: string
  listing: {
    id: string
    title: string
    price: number
    status: string
    section: string
    city: string | null
    state: string | null
    listing_images: { url: string; is_primary: boolean }[]
  }
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchFavorites()
  }, [])

  async function fetchFavorites() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('favorites')
      .select(`
        id,
        created_at,
        listing:listings(
          id,
          title,
          price,
          status,
          section,
          city,
          state,
          listing_images(url, is_primary)
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setFavorites(data as unknown as Favorite[])
    }
    setLoading(false)
  }

  async function removeFavorite(favoriteId: string) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('id', favoriteId)

    if (!error) {
      setFavorites(prev => prev.filter(f => f.id !== favoriteId))
      toast.success('Removed from favorites')
    } else {
      toast.error('Failed to remove favorite')
    }
  }

  const getSectionLabel = (section: string) => {
    switch (section) {
      case 'used': return 'Used Gear'
      case 'new': return 'New Items'
      case 'surfboards': return 'Surfboards'
      default: return section
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Saved Items</h1>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="w-24 h-24 bg-muted rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-5 bg-muted rounded w-1/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
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
        <div className="grid gap-4 md:grid-cols-2">
          {favorites.map((favorite) => {
            const listing = favorite.listing
            if (!listing) return null

            const primaryImage = listing.listing_images?.find(img => img.is_primary) || listing.listing_images?.[0]

            return (
              <Card key={favorite.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <Link 
                      href={`/${listing.section}/${listing.id}`}
                      className="relative w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0"
                    >
                      {primaryImage?.url ? (
                        <Image
                          src={primaryImage.url || "/placeholder.svg"}
                          alt={listing.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Heart className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      {listing.status === 'sold' && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <span className="text-sm font-semibold text-foreground">SOLD</span>
                        </div>
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link 
                        href={`/${listing.section}/${listing.id}`}
                        className="font-semibold text-foreground hover:text-primary line-clamp-2"
                      >
                        {listing.title}
                      </Link>
                      <p className="text-lg font-bold text-primary mt-1">${listing.price}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {getSectionLabel(listing.section)}
                        </Badge>
                        {listing.city && listing.state && (
                          <span className="text-xs text-muted-foreground">
                            {listing.city}, {listing.state}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Saved {formatDistanceToNow(new Date(favorite.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Link href={`/${listing.section}/${listing.id}`}>
                        <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive bg-transparent"
                        onClick={() => removeFavorite(favorite.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
