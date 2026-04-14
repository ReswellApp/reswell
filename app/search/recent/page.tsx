import { SearchPageView } from "../search-page-view"
import { pageSeoMetadata } from "@/lib/site-metadata"

interface SearchParams {
  category?: string
}

export const dynamic = "force-dynamic"

export const metadata = pageSeoMetadata({
  title: "Recently listed surfboards | Reswell",
  description:
    "Browse the latest surfboard listings on Reswell — a curated feed from active sellers.",
  path: "/search/recent",
})

export default async function SearchRecentPage(props: {
  searchParams: Promise<SearchParams>
}) {
  const searchParams = await props.searchParams
  const categorySlugFromUrl = (searchParams.category ?? "").trim()

  return (
    <SearchPageView
      rawQuery=""
      categorySlugFromUrl={categorySlugFromUrl}
      showSeoBookmark
    />
  )
}
