import type { Metadata } from "next"
import { SearchPageView } from "../search-page-view"

interface SearchParams {
  section?: string
}

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Recently listed surf gear | Reswell",
    description:
      "Browse the latest surfboards and used gear on Reswell — a curated feed of new marketplace listings from active sellers.",
    alternates: {
      canonical: "/search/recent",
    },
    openGraph: {
      title: "Recently listed surf gear | Reswell",
      description:
        "Browse the latest surfboards and used gear — curated new listings on Reswell.",
      url: "/search/recent",
    },
  }
}

export default async function SearchRecentPage(props: {
  searchParams: Promise<SearchParams>
}) {
  const searchParams = await props.searchParams
  const sectionParam = (searchParams.section ?? "all") as
    | "all"
    | "used"
    | "boards"

  return (
    <SearchPageView
      rawQuery=""
      sectionParam={sectionParam}
      showSeoBookmark
    />
  )
}
