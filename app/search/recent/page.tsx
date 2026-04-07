import type { Metadata } from "next"
import { SearchPageView } from "../search-page-view"

interface SearchParams {
  category?: string
}

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Recently listed surfboards | Reswell",
    description:
      "Browse the latest surfboard listings on Reswell — a curated feed from active sellers.",
    alternates: {
      canonical: "/search/recent",
    },
    openGraph: {
      title: "Recently listed surfboards | Reswell",
      description: "Browse the latest surfboard listings — curated new posts on Reswell.",
      url: "/search/recent",
    },
  }
}

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
