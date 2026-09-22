"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { authLandingHref } from "@/lib/auth/auth-landing-href"
import { createClient } from "@/lib/supabase/client"
import {
  HomePeerListingScrollTile,
  type HomePeerScrollListing,
} from "@/components/features/home/home-peer-listing-scroll-tile"
import { ShopNewListingStandardTile } from "@/components/features/marketplace/shop-new-listing-standard-tile"
import type { ListingImageForCard } from "@/lib/listing-image-display"
import { TrendingBrandsSection } from "@/components/features/home/trending-brands-section"
import type { HomeTrendingBrandRow } from "@/lib/db/home-trending-brands"

/**
 * ISR-safe homepage viewer state. The server page is user-agnostic (same HTML for
 * everyone). After mount we hydrate favorites, viewer id, and admin from the
 * browser Supabase client — same pattern as RecentFeedClient on /search/recent.
 */
export type HomeViewerState = {
  userId: string | null
  favoritedIds: string[]
  isAdmin: boolean
  hydrated: boolean
}

const HomeViewerContext = createContext<HomeViewerState>({
  userId: null,
  favoritedIds: [],
  isAdmin: false,
  hydrated: false,
})

export function useHomeViewer(): HomeViewerState {
  return useContext(HomeViewerContext)
}

export function HomeViewerProvider({
  listingIds,
  children,
}: {
  listingIds: string[]
  children: ReactNode
}) {
  const listingIdsKey = useMemo(
    () => Array.from(new Set(listingIds.filter((id) => id.length > 0))).join(","),
    [listingIds],
  )
  const [state, setState] = useState<HomeViewerState>({
    userId: null,
    favoritedIds: [],
    isAdmin: false,
    hydrated: false,
  })

  useEffect(() => {
    let cancelled = false
    const ids = listingIdsKey.length > 0 ? listingIdsKey.split(",") : []

    async function hydrate() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setState({ userId: null, favoritedIds: [], isAdmin: false, hydrated: true })
        return
      }

      const [favoritesRes, adminRes] = await Promise.all([
        ids.length > 0
          ? supabase.from("favorites").select("listing_id").eq("user_id", user.id).in("listing_id", ids)
          : Promise.resolve({ data: null as { listing_id: string }[] | null }),
        supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
      ])
      if (cancelled) return

      setState({
        userId: user.id,
        favoritedIds: (favoritesRes.data ?? []).map((row) => row.listing_id),
        isAdmin: adminRes.data?.is_admin === true,
        hydrated: true,
      })
    }

    void hydrate()
    return () => {
      cancelled = true
    }
  }, [listingIdsKey])

  return <HomeViewerContext.Provider value={state}>{children}</HomeViewerContext.Provider>
}

/** Sign up vs Start Selling — defaults to the anonymous CTA until the island hydrates. */
export function HomeHeroPrimaryCta() {
  const { userId } = useHomeViewer()

  if (userId) {
    return (
      <Button size="lg" className="w-full" asChild>
        <Link href="/sell">Start Selling</Link>
      </Button>
    )
  }

  return (
    <Button size="lg" className="w-full" asChild>
      <Link href={authLandingHref("/auth/sign-up")}>Sign up</Link>
    </Button>
  )
}

export function HomeHydratedPeerListingTile({
  listing,
  imagePriority = false,
  layout = "homeScroll",
  imageSizesOverride,
}: {
  listing: HomePeerScrollListing
  imagePriority?: boolean
  layout?: "homeScroll" | "grid"
  imageSizesOverride?: string
}) {
  const { userId, favoritedIds } = useHomeViewer()
  return (
    <HomePeerListingScrollTile
      listing={listing}
      userId={userId}
      isFavorited={favoritedIds.includes(listing.id)}
      imagePriority={imagePriority}
      layout={layout}
      imageSizesOverride={imageSizesOverride}
    />
  )
}

export function HomeHydratedShopNewTile({
  listing,
  stockQuantity,
  categoryName,
}: {
  listing: {
    id: string
    slug: string | null
    title: string
    price: number
    compare_at_price?: number | null
    listing_images: unknown
  }
  stockQuantity: number
  categoryName: string | null
}) {
  const { userId, favoritedIds } = useHomeViewer()
  return (
    <ShopNewListingStandardTile
      layout="homeScroll"
      listing={{
        ...listing,
        listing_images: (listing.listing_images ?? null) as ListingImageForCard[] | null,
      }}
      stockQuantity={stockQuantity}
      userId={userId}
      isFavorited={favoritedIds.includes(listing.id)}
      categoryName={categoryName}
    />
  )
}

export function HomeHydratedTrendingBrandsSection({ rows }: { rows: HomeTrendingBrandRow[] }) {
  const { isAdmin } = useHomeViewer()
  return <TrendingBrandsSection rows={rows} isAdmin={isAdmin} />
}
