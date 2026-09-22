import { Suspense } from "react"
import { permanentRedirect, redirect } from "next/navigation"
import { NavSearchQueryParamCleanup } from "@/components/features/search/nav-search-query-param-cleanup"
import { SearchResultsPageSkeleton } from "@/components/search-results-page-skeleton"
import { pageSeoMetadata } from "@/lib/site-metadata"
import { marketplaceSearchRedirect } from "@/lib/utils/marketplace-search-redirect"
import { marketplaceBoardStyleBrowseHref } from "@/lib/utils/marketplace-style-query"
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

/**
 * ISR shell + cached listing results (60s), matching `/search/recent`.
 * Auth/favorites stay inside Suspense so cookies do not dynamize the route.
 */
export const revalidate = 60

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

  // Edge proxy emits these as HTTP 307/308. Keep the same rules here so
  // server-rendered /search still cannot fall through if proxy is skipped.
  const dest = marketplaceSearchRedirect(
    {
      rawQuery,
      brandSlug: brandSlugFromUrl,
      categorySlug: categorySlugFromUrl,
    },
    marketplaceBoardStyleBrowseHref,
  )
  if (dest) {
    if (dest.permanent) permanentRedirect(dest.href)
    redirect(dest.href)
  }

  return (
    <>
      <Suspense fallback={null}>
        <NavSearchQueryParamCleanup />
      </Suspense>
      <Suspense fallback={<SearchResultsPageSkeleton />}>
        <SearchPageView
          rawQuery={rawQuery}
          brandSlugFromUrl={brandSlugFromUrl}
          categorySlugFromUrl={categorySlugFromUrl}
          analyticsOriginHeaderNav={analyticsOriginHeaderNav}
        />
      </Suspense>
    </>
  )
}
