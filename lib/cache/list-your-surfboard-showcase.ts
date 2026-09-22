import { unstable_cache } from "next/cache"
import {
  getTopMarketplaceShowcaseReviews,
  type MarketplaceShowcaseReviewRow,
} from "@/lib/db/marketplace-reviews-showcase"
import { loadHomeHeroSlideUrls } from "@/lib/services/homeHeroSlides"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"

export const LIST_YOUR_SURFBOARD_SHOWCASE_CACHE_TAG = "list-your-surfboard-showcase"
export const LIST_YOUR_SURFBOARD_SHOWCASE_REVALIDATE_SECONDS = 60 * 60

export type ListYourSurfboardShowcase = {
  reviews: MarketplaceShowcaseReviewRow[]
  heroListingImages: string[]
}

async function loadListYourSurfboardShowcase(): Promise<ListYourSurfboardShowcase> {
  const supabase = createAnonSupabaseClient()
  const [{ data: reviews }, heroSlideUrls] = await Promise.all([
    getTopMarketplaceShowcaseReviews(supabase, {
      limitPerRole: 8,
      minRating: 4,
    }),
    loadHomeHeroSlideUrls(supabase, { section: "surfboards", listingImagesOnly: true }),
  ])
  return {
    reviews,
    heroListingImages: heroSlideUrls.slice(0, 4),
  }
}

const getCachedListYourSurfboardShowcaseRow = unstable_cache(
  loadListYourSurfboardShowcase,
  ["list-your-surfboard-showcase", "v1"],
  {
    revalidate: LIST_YOUR_SURFBOARD_SHOWCASE_REVALIDATE_SECONDS,
    tags: [LIST_YOUR_SURFBOARD_SHOWCASE_CACHE_TAG],
  },
)

/** Public hero + marketplace reviews for `/listyoursurfboard` (viewer-independent). */
export async function getCachedListYourSurfboardShowcase(): Promise<ListYourSurfboardShowcase> {
  return getCachedListYourSurfboardShowcaseRow()
}
