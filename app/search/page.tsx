import { Suspense } from "react"
import { permanentRedirect } from "next/navigation"
import { NavSearchQueryParamCleanup } from "@/components/features/search/nav-search-query-param-cleanup"
import { pageSeoMetadata } from "@/lib/site-metadata"
import { SearchPageView } from "./search-page-view"

interface SearchParams {
  q?: string
  category?: string
  view?: string
  /** Directory brand (`public.brands.slug`) — browse all marketplace listings for that brand. */
  brandSlug?: string
  /** Internal — header nav attribution for analytics (stripped client-side). */
  nq?: string
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
  const brandSlugFromUrl = (searchParams.brandSlug ?? "").trim()
  const analyticsOriginHeaderNav = searchParams.nq === "1"

  if (!rawQuery && !brandSlugFromUrl) {
    const sp = new URLSearchParams()
    if (categorySlugFromUrl) sp.set("category", categorySlugFromUrl)
    permanentRedirect(`/search/recent${sp.size ? `?${sp}` : ""}`)
  }

  return (
    <>
      <Suspense fallback={null}>
        <NavSearchQueryParamCleanup />
      </Suspense>
      <SearchPageView
        rawQuery={rawQuery}
        brandSlugFromUrl={brandSlugFromUrl}
        categorySlugFromUrl={categorySlugFromUrl}
        showSeoBookmark={false}
        analyticsOriginHeaderNav={analyticsOriginHeaderNav}
      />
    </>
  )
}
