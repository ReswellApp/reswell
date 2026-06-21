import { BoardsBrowsePage } from "@/components/boards-browse-page"
import { createClient } from "@/lib/supabase/server"
import { getTopMarketplaceShowcaseReviews } from "@/lib/db/marketplace-reviews-showcase"
import {
  BOARDS_BROWSE_NEWEST_SORT,
  type BoardsBrowseSearchParams,
} from "@/lib/marketplace-slug-metadata"
import { loadHomeHeroSlideUrls } from "@/lib/services/homeHeroSlides"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

function flattenSearchParams(
  sp: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  const o: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp)) {
    o[k] = Array.isArray(v) ? v[0] : v
  }
  return o
}

export async function generateMetadata() {
  return resolvePageMetadata("listyoursurfboard")
}

export default async function ListYourSurfboardPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const rawSp = await props.searchParams
  const flat = flattenSearchParams(rawSp)

  const supabase = await createClient()
  const [{ data: topMarketplaceReviews }, heroSlideUrls] = await Promise.all([
    getTopMarketplaceShowcaseReviews(supabase, {
      limitPerRole: 8,
      minRating: 4,
    }),
    loadHomeHeroSlideUrls(supabase, { section: "surfboards", listingImagesOnly: true }),
  ])

  return (
    <BoardsBrowsePage
      searchParams={Promise.resolve(flat as BoardsBrowseSearchParams)}
      showListYourSurfboardCta
      defaultSort={BOARDS_BROWSE_NEWEST_SORT}
      topMarketplaceReviews={topMarketplaceReviews}
      heroListingImages={heroSlideUrls.slice(0, 4)}
    />
  )
}
