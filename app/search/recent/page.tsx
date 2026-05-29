import { SearchPageView } from "../search-page-view"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

interface SearchParams {
  category?: string
}

export const dynamic = "force-dynamic"

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
    />
  )
}
