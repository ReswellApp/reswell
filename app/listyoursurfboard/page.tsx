import { BoardsBrowsePage } from "@/components/boards-browse-page"
import { getCachedListYourSurfboardShowcase } from "@/lib/cache/list-your-surfboard-showcase"
import {
  BOARDS_BROWSE_NEWEST_SORT,
  type BoardsBrowseSearchParams,
} from "@/lib/marketplace-slug-metadata"
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
  const { reviews, heroListingImages } = await getCachedListYourSurfboardShowcase()

  return (
    <BoardsBrowsePage
      searchParams={Promise.resolve(flat as BoardsBrowseSearchParams)}
      browsePath="/listyoursurfboard"
      showListYourSurfboardCta
      defaultSort={BOARDS_BROWSE_NEWEST_SORT}
      topMarketplaceReviews={reviews}
      heroListingImages={heroListingImages}
    />
  )
}
