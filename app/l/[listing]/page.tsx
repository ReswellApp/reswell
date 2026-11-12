import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { pageSeoMetadata } from "@/lib/site-metadata"
import {
  getCachedPublicListingForMetadata,
  getCachedPublicListingForRoute,
} from "@/lib/listing-detail-cache"
import { resolveListingDetailMetadata } from "@/lib/seo/resolve-listing-metadata"
import { ListingDetailDynamicGate } from "@/components/features/listings/listing-detail-dynamic-gate"
import { ListingDetailPublicOrAuthenticated } from "@/components/features/listings/listing-detail-public-or-authenticated"
import type { PublicListingRow } from "@/components/features/listings/listing-detail-public-body"
import { ListingDetailRoutePending } from "@/components/listing-detail-page-loading"
import { ListingPublishedCelebration } from "@/components/features/listings/listing-published-celebration"

/** ISR shell — keep in sync with `LISTING_PUBLIC_DETAIL_REVALIDATE_SECONDS`. */
export const revalidate = 3600

function unavailableListingMetadata(listingParam: string): Metadata {
  return pageSeoMetadata({
    title: "This listing is no longer available — Reswell",
    description: "Check out related listings on Reswell.",
    path: `/l/${listingParam}`,
    robots: { index: false, follow: true },
  })
}

export async function generateMetadata(props: {
  params: Promise<{ listing: string }>
}): Promise<Metadata> {
  const { listing: listingParam } = await props.params
  const { listing } = await getCachedPublicListingForMetadata(listingParam)
  // Public cache only. cookies() here dynamizes the whole /l route even when
  // the miss/hidden branch is not taken. Hidden listings still render for
  // owners via ListingDetailDynamicGate; their share tags stay unavailable.
  if (!listing || listing.hidden_from_site) {
    return unavailableListingMetadata(listingParam)
  }
  if (listing.section === "new") {
    const price = Number(listing.price)
    const pricePrefix = Number.isFinite(price) ? `$${price.toFixed(2)}` : undefined
    return resolveListingDetailMetadata({ ...listing, section: "new" as const }, { pricePrefix })
  }
  return resolveListingDetailMetadata(listing)
}

export default async function ListingDetailPage(props: {
  params: Promise<{ listing: string }>
}) {
  const { listing: listingParam } = await props.params
  const { listing, redirectSlug } = await getCachedPublicListingForRoute(listingParam)

  if (listing && !listing.hidden_from_site) {
    if (redirectSlug) {
      redirect(`/l/${redirectSlug}`)
    }

    // No photo-only Suspense fallback. The segment `loading.tsx` holds until the
    // full above-the-fold PDP is ready so the gallery and the rest of the HTML
    // commit together. Below-fold rails stay in their own Suspense inside the
    // section page.
    return (
      <>
        <ListingDetailPublicOrAuthenticated
          listingParam={listingParam}
          listing={listing as PublicListingRow}
          redirectSlug={redirectSlug}
        />
        <ListingPublishedCelebration listingParam={listingParam} />
      </>
    )
  }

  return (
    <>
      <Suspense fallback={<ListingDetailRoutePending />}>
        <ListingDetailDynamicGate
          listingParam={listingParam}
          prefetchedListing={(listing as Record<string, unknown> | null) ?? null}
          prefetchedRedirectSlug={redirectSlug}
        />
      </Suspense>
      <ListingPublishedCelebration listingParam={listingParam} />
    </>
  )
}
