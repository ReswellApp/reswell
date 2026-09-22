import { Suspense } from "react"
import { permanentRedirect, redirect } from "next/navigation"
import { NavSearchQueryParamCleanup } from "@/components/features/search/nav-search-query-param-cleanup"
import { SearchResultsPageSkeleton } from "@/components/search-results-page-skeleton"
import { pageSeoMetadata } from "@/lib/site-metadata"
import {
  extractMarketplaceSectionIntent,
  isMarketplaceSectionOnlyQuery,
  marketplaceSectionBrowseHref,
} from "@/lib/utils/marketplace-brand-query"
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

export default function SearchPage(props: {
  searchParams: Promise<SearchParams>
}) {
  return (
    <>
      <Suspense fallback={null}>
        <NavSearchQueryParamCleanup />
      </Suspense>
      <Suspense fallback={<SearchResultsPageSkeleton />}>
        <SearchPageFromParams searchParams={props.searchParams} />
      </Suspense>
    </>
  )
}

async function SearchPageFromParams({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<SearchParams>
}) {
  const searchParams = await searchParamsPromise
  const rawQuery = (searchParams.q ?? "").trim()
  const categorySlugFromUrl = (searchParams.category ?? "").trim()
  const brandSlugFromUrl = (searchParams.brandSlug ?? "").trim()
  const analyticsOriginHeaderNav = searchParams.nq === "1"

  if (!rawQuery && !brandSlugFromUrl) {
    const sp = new URLSearchParams()
    if (categorySlugFromUrl) sp.set("category", categorySlugFromUrl)
    permanentRedirect(`/search/recent${sp.size ? `?${sp}` : ""}`)
  }

  // Bare "fins" / "wetsuits" / etc. → section browse, not a brand that contains that word.
  if (rawQuery && !brandSlugFromUrl && isMarketplaceSectionOnlyQuery(rawQuery)) {
    const browseHref = marketplaceSectionBrowseHref(extractMarketplaceSectionIntent(rawQuery))
    if (browseHref) redirect(browseHref)
  }

  // Bare "fish" / "shortboard" / etc. → board-type browse, not Fish Stix / similar.
  if (rawQuery && !brandSlugFromUrl) {
    const styleHref = marketplaceBoardStyleBrowseHref(rawQuery)
    if (styleHref) redirect(styleHref)
  }

  return (
    <SearchPageView
      rawQuery={rawQuery}
      brandSlugFromUrl={brandSlugFromUrl}
      categorySlugFromUrl={categorySlugFromUrl}
      analyticsOriginHeaderNav={analyticsOriginHeaderNav}
    />
  )
}
