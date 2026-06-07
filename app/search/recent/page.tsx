import { SearchPageView } from "../search-page-view"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

interface SearchParams {
  category?: string
}

/**
 * ISR: curated listings are the same for everyone. User-specific state (favorites,
 * viewer ID) is hydrated on the client after mount to avoid baking per-user data
 * into the cached HTML. See RecentFeedClient for the client-side hydration path.
 */
export const revalidate = 60

export async function generateMetadata() {
  return resolvePageMetadata("search-recent")
}

export default async function SearchRecentPage(props: {
  searchParams: Promise<SearchParams>
}) {
  const searchParams = await props.searchParams
  const categorySlugFromUrl = (searchParams.category ?? "").trim()

  return (
    <SearchPageView
      rawQuery=""
      brandSlugFromUrl=""
      categorySlugFromUrl={categorySlugFromUrl}
      showSeoBookmark
      skipAuthLookup
    />
  )
}
