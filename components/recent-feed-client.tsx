"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
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
  /** Completion time for sold rows (from `listings.updated_at`). */
  updated_at?: string | null
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
  /** Sold strip: "Sold" label under title (see `/sold`, brand sold grids). */
  soldPresentation?: boolean
  /**
   * When true (ISR-cached pages), the server skipped auth to avoid baking
   * per-user data into the cached HTML. Favorites and viewer ID are fetched
   * from the browser Supabase client after mount so hearts and own-listing
   * detection still work correctly for logged-in users.
   */
  hydrateOwnFavorites?: boolean
}

export function RecentFeedClient({
  listings,
  favoritedListingIds,
  isLoggedIn: _isLoggedIn,
  viewerUserId,
  emptyMessage,
  soldPresentation = false,
  hydrateOwnFavorites = false,
}: RecentFeedClientProps) {
  const [clientFavIds, setClientFavIds] = useState<string[] | null>(null)
  const [clientViewerUserId, setClientViewerUserId] = useState<string | null>(viewerUserId)

  useEffect(() => {
    if (!hydrateOwnFavorites) return
    let cancelled = false

    async function hydrate() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      setClientViewerUserId(user?.id ?? null)
      if (!user) {
        setClientFavIds([])
        return
      }
      const { data: favs } = await supabase
        .from("favorites")
        .select("listing_id")
        .eq("user_id", user.id)
      if (!cancelled) {
        setClientFavIds((favs ?? []).map((f) => f.listing_id))
      }
    }

    void hydrate()
    return () => {
      cancelled = true
    }
  }, [hydrateOwnFavorites])

  // When hydrateOwnFavorites is set, clientFavIds starts null (before hydration)
  // and updates after the auth check; fall back to the server-provided array
  // (empty on ISR-cached pages) until the client result arrives.
  const effectiveFavIds = clientFavIds ?? favoritedListingIds
  const effectiveViewerUserId = clientViewerUserId

  if (!listings.length) {
    return (
      <p className="text-center text-muted-foreground py-12">
        {emptyMessage ?? "No recent listings yet. Check back soon."}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {listings.map((listing, tileIdx) => (
        <HomePeerListingScrollTile
          key={listing.id}
          layout="grid"
          userId={effectiveViewerUserId}
          isFavorited={effectiveFavIds.includes(listing.id)}
          imagePriority={tileIdx < 2}
          statusLabel={soldPresentation ? "sold" : undefined}
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
