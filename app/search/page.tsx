import { Suspense } from "react"
import type { Metadata } from "next"
import { permanentRedirect, redirect } from "next/navigation"
import { NavSearchQueryParamCleanup } from "@/components/features/search/nav-search-query-param-cleanup"
import { listingCardImageSrc } from "@/lib/listing-image-display"
import { absolutePublicMediaUrl, absoluteUrl, pageSeoMetadata } from "@/lib/site-metadata"
import {
  extractMarketplaceSectionIntent,
  isMarketplaceSectionOnlyQuery,
  marketplaceSectionBrowseHref,
} from "@/lib/utils/marketplace-brand-query"
import { marketplaceBoardStyleBrowseHref } from "@/lib/utils/marketplace-style-query"
import { getSearchShareListing, SearchPageView } from "./search-page-view"

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

const SEARCH_TITLE = "Search — Reswell"
const SEARCH_DESCRIPTION =
  "Search surfboards and gear — empty searches redirect to recent marketplace results."

export async function generateMetadata(props: {
  searchParams: Promise<SearchParams>
}): Promise<Metadata> {
  const searchParams = await props.searchParams
  const baseMetadata = pageSeoMetadata({
    title: SEARCH_TITLE,
    description: SEARCH_DESCRIPTION,
    path: "/search",
  })
  const fallbackImageUrl = absoluteUrl("/images/og-image.jpg")

  let shareImageUrl = fallbackImageUrl
  try {
    const listing = await getSearchShareListing({
      rawQuery: (searchParams.q ?? "").trim(),
      brandSlugFromUrl: (searchParams.brandSlug ?? "").trim(),
      categorySlugFromUrl: (searchParams.category ?? "").trim(),
    })
    const listingImageUrl = listingCardImageSrc(listing?.listing_images)
    shareImageUrl = absolutePublicMediaUrl(listingImageUrl) ?? fallbackImageUrl
  } catch (error) {
    console.error("[search] Failed to resolve share image:", error)
  }

  return {
    ...baseMetadata,
    openGraph: {
      ...baseMetadata.openGraph,
      images: [{ url: shareImageUrl }],
    },
    twitter: {
      ...baseMetadata.twitter,
      images: [shareImageUrl],
    },
  }
}

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
    <>
      <Suspense fallback={null}>
        <NavSearchQueryParamCleanup />
      </Suspense>
      <SearchPageView
        rawQuery={rawQuery}
        brandSlugFromUrl={brandSlugFromUrl}
        categorySlugFromUrl={categorySlugFromUrl}
        analyticsOriginHeaderNav={analyticsOriginHeaderNav}
      />
    </>
  )
}
