import { ListYourSurfboardLanding } from "@/components/features/marketing/list-your-surfboard-landing"
import type { HomePeerScrollListing } from "@/components/features/home/home-peer-listing-scroll-tile"
import { createClient } from "@/lib/supabase/server"
import { loadHomeFeaturedSurfboardRows } from "@/lib/services/homeFeaturedPeerSections"
import { loadHomeHeroSlideUrls } from "@/lib/services/homeHeroSlides"
import { loadHomeRecentlySoldSurfboardRows } from "@/lib/services/homeRecentlySoldStrip"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata() {
  return resolvePageMetadata("listyoursurfboard")
}

export const dynamic = "force-dynamic"

export default async function ListYourSurfboardPage() {
  const supabase = await createClient()

  const [surfboardFeaturedRows, recentlySoldFeaturedRows, heroSlideUrls, authRes] = await Promise.all([
    loadHomeFeaturedSurfboardRows(supabase),
    loadHomeRecentlySoldSurfboardRows(supabase),
    loadHomeHeroSlideUrls(supabase),
    supabase.auth.getUser(),
  ])

  const featuredBoards = surfboardFeaturedRows as HomePeerScrollListing[]
  const featuredRecentlySold = recentlySoldFeaturedRows as HomePeerScrollListing[]
  const {
    data: { user },
  } = authRes

  const featuredListingIds = [
    ...featuredBoards.map((board) => board.id),
    ...featuredRecentlySold.map((board) => board.id),
  ]

  const favoritesRes =
    user && featuredListingIds.length > 0
      ? await supabase
          .from("favorites")
          .select("listing_id")
          .eq("user_id", user.id)
          .in("listing_id", featuredListingIds)
      : { data: null as { listing_id: string }[] | null }

  const favoritedIds = (favoritesRes.data ?? []).map((favorite) => favorite.listing_id)

  return (
    <ListYourSurfboardLanding
      heroSlideUrls={heroSlideUrls}
      featuredBoards={featuredBoards}
      featuredRecentlySold={featuredRecentlySold}
      userId={user?.id ?? null}
      favoritedIds={favoritedIds}
    />
  )
}
