import { permanentRedirect } from "next/navigation"
import { pageSeoMetadata } from "@/lib/site-metadata"
import { SearchPageView } from "./search-page-view"

interface SearchParams {
  q?: string
  category?: string
  view?: string
}

/** Search uses query params + auth; must not be statically prerendered. */
export const dynamic = "force-dynamic"

export const metadata = pageSeoMetadata({
  title: "Search — Reswell",
  description: "Search surfboards and gear — empty searches redirect to recent marketplace results.",
  path: "/search",
})

export default async function SearchPage(props: {
  searchParams: Promise<SearchParams>
}) {
  const searchParams = await props.searchParams
  const rawQuery = (searchParams.q ?? "").trim()
  const categorySlugFromUrl = (searchParams.category ?? "").trim()

  if (!rawQuery) {
    const sp = new URLSearchParams()
    if (categorySlugFromUrl) sp.set("category", categorySlugFromUrl)
    permanentRedirect(`/search/recent${sp.size ? `?${sp}` : ""}`)
  }

  return (
    <SearchPageView
      rawQuery={rawQuery}
      categorySlugFromUrl={categorySlugFromUrl}
      showSeoBookmark={false}
    />
  )
}
