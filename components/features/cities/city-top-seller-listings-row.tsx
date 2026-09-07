"use client"

import { useEffect, useState } from "react"
import { CityLandingStripSection } from "@/components/features/cities/city-landing-strip-section"
import { HomeListingScrollRow } from "@/components/features/home/home-listing-scroll-row"
import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
import { cityTopListingTileWrapClass } from "@/lib/home-listing-scroll-styles"
import { createClient } from "@/lib/supabase/client"
import type { CityLandingListing } from "@/lib/types/city-landing"
import type { ListingImageForCard } from "@/lib/listing-image-display"

const CITY_TOP_LISTING_IMAGE_SIZES = "(max-width: 639px) 30svw, 160px"

export function CityTopSellerListingsRow({
  cityName,
  listings,
}: {
  cityName: string
  listings: CityLandingListing[]
}) {
  const [viewerUserId, setViewerUserId] = useState<string | null>(null)
  const [favoritedIds, setFavoritedIds] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    const listingIds = listings.map((listing) => listing.id)

    async function hydrateFavorites() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      setViewerUserId(user?.id ?? null)
      if (!user || listingIds.length === 0) {
        setFavoritedIds([])
        return
      }
      const { data: favs } = await supabase
        .from("favorites")
        .select("listing_id")
        .eq("user_id", user.id)
        .in("listing_id", listingIds)
      if (!cancelled) {
        setFavoritedIds((favs ?? []).map((row) => row.listing_id))
      }
    }

    void hydrateFavorites()
    return () => {
      cancelled = true
    }
  }, [listings])

  if (listings.length === 0) return null

  return (
    <CityLandingStripSection
      label={`Top listings in ${cityName}`}
      title={`Top listings in ${cityName}`}
      emphasis
    >
      <HomeListingScrollRow
        inset
        uniformCardHeights
        tileWrapClassName={cityTopListingTileWrapClass}
        rowGapClassName="gap-2 sm:gap-2.5"
      >
        {listings.map((listing, tileIdx) => (
          <HomePeerListingScrollTile
            key={listing.id}
            listing={{
              id: listing.id,
              slug: listing.slug,
              user_id: listing.user_id,
              title: listing.title,
              price: listing.price,
              compare_at_price: listing.compare_at_price,
              status: listing.status ?? "active",
              section: listing.section,
              local_pickup: listing.local_pickup,
              shipping_available: listing.shipping_available,
              listing_images: listing.listing_images as ListingImageForCard[] | null,
              categories: listing.categories,
              board_type: listing.board_type,
              condition: listing.condition && listing.condition.trim() !== "" ? listing.condition : null,
            }}
            userId={viewerUserId}
            isFavorited={favoritedIds.includes(listing.id)}
            imagePriority={tileIdx === 0}
            compact
            imageSizesOverride={CITY_TOP_LISTING_IMAGE_SIZES}
          />
        ))}
      </HomeListingScrollRow>
    </CityLandingStripSection>
  )
}
