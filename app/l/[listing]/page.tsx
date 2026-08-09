import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { pageSeoMetadata } from "@/lib/site-metadata"
import { findListingByParam } from "@/lib/listing-query"
import {
  getCachedPublicListingForMetadata,
  getCachedPublicListingForRoute,
  SURFBOARD_LISTING_SELECT,
} from "@/lib/listing-detail-cache"
import { resolveListingDetailMetadata } from "@/lib/seo/resolve-listing-metadata"
import { canViewHiddenListing } from "@/lib/listing-site-access"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { ListingDetailDynamicGate } from "@/components/features/listings/listing-detail-dynamic-gate"
import { ListingDetailPublicOrAuthenticated } from "@/components/features/listings/listing-detail-public-or-authenticated"
import type { PublicListingRow } from "@/components/features/listings/listing-detail-public-body"
import { ListingDetailRouteSkeleton } from "@/components/listing-detail-page-loading"
import { ListingPublishedCelebration } from "@/components/features/listings/listing-published-celebration"

/** ISR shell — keep in sync with `LISTING_PUBLIC_DETAIL_REVALIDATE_SECONDS`. */
export const revalidate = 3600

function unavailableListingMetadata(listingParam: string): Metadata {
  return pageSeoMetadata({
    title: "This listing is no longer available — Reswell",
    description: "Check out related listings on Reswell.",
    path: `/l/${listingParam}`,
  })
}

export async function generateMetadata(props: {
  params: Promise<{ listing: string }>
}): Promise<Metadata> {
  const { listing: listingParam } = await props.params
  let { listing } = await getCachedPublicListingForMetadata(listingParam)
  if (!listing) {
    const { supabase } = await getCachedRequestSession()
    const live = await findListingByParam(supabase, listingParam, {
      select: SURFBOARD_LISTING_SELECT,
      section: undefined,
      includeHiddenListings: true,
    })
    listing = live.listing
  }
  if (!listing) {
    return unavailableListingMetadata(listingParam)
  }
  if (listing.hidden_from_site) {
    const { supabase, user } = await getCachedRequestSession()
    if (!(await canViewHiddenListing(supabase, listing, user))) {
      return unavailableListingMetadata(listingParam)
    }
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

    return (
      <>
        <Suspense fallback={<ListingDetailRouteSkeleton />}>
          <ListingDetailPublicOrAuthenticated
            listingParam={listingParam}
            listing={listing as PublicListingRow}
            redirectSlug={redirectSlug}
          />
        </Suspense>
        <ListingPublishedCelebration listingParam={listingParam} />
      </>
    )
  }

  return (
    <>
      <Suspense fallback={<ListingDetailRouteSkeleton />}>
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
