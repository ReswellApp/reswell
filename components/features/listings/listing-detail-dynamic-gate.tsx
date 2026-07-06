import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { findListingByParam } from "@/lib/listing-query"
import { SURFBOARD_LISTING_SELECT } from "@/lib/listing-detail-cache"
import { canViewHiddenListing } from "@/lib/listing-site-access"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { createClient } from "@/lib/supabase/server"
import { isGoogleMerchantLandingPageCrawler } from "@/lib/google-merchant/landing-page-crawler"
import {
  isGoogleMerchantEligibleListing,
  type GoogleMerchantListingRow,
} from "@/lib/google-merchant/map-listing-to-product-input"
import { UnavailableListingLandingPage } from "@/components/features/listings/unavailable-listing-landing-page"
import { buildUnavailableListingLanding } from "@/lib/services/unavailableListingLanding"
import {
  UNAVAILABLE_LISTING_CONTEXT_SELECT,
  type UnavailableListingContextRow,
} from "@/lib/db/unavailable-listing-landing"
import type { ListingDetailPageSharedProps } from "@/lib/listing-detail-page-load"
import {
  ListingDetailPublicBody,
  type PublicListingRow,
} from "@/components/features/listings/listing-detail-public-body"

function rejectMerchantCrawlerLandingPage(
  listing: GoogleMerchantListingRow | null,
  userAgent: string | null,
): void {
  if (!isGoogleMerchantLandingPageCrawler(userAgent)) return
  if (!listing || !isGoogleMerchantEligibleListing(listing)) {
    notFound()
  }
}

async function loadUnavailableListingContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listingParam: string,
): Promise<UnavailableListingContextRow | null> {
  const { listing } = await findListingByParam(supabase, listingParam, {
    select: UNAVAILABLE_LISTING_CONTEXT_SELECT,
    section: undefined,
    includeHiddenListings: true,
  })
  return listing as UnavailableListingContextRow | null
}

/**
 * Live lookup + auth gates for sold, hidden, or cache-miss PDPs.
 * Kept out of the hourly ISR shell so anonymous catalog crawlers stay on the edge cache.
 */
export async function ListingDetailDynamicGate({
  listingParam,
  prefetchedListing,
  prefetchedRedirectSlug,
}: {
  listingParam: string
  prefetchedListing: Record<string, unknown> | null
  prefetchedRedirectSlug: string | null
}) {
  const userAgent = (await headers()).get("user-agent")
  const { supabase, user } = await getCachedRequestSession()
  let listing = prefetchedListing
  let redirectSlug = prefetchedRedirectSlug

  if (!listing) {
    const live = await findListingByParam(supabase, listingParam, {
      select: SURFBOARD_LISTING_SELECT,
      section: undefined,
      includeHiddenListings: true,
    })
    listing = live.listing as Record<string, unknown> | null
    redirectSlug = live.redirectSlug
  }

  if (!listing) {
    rejectMerchantCrawlerLandingPage(null, userAgent)
    const landing = await buildUnavailableListingLanding(supabase, listingParam)
    return <UnavailableListingLandingPage landing={landing} />
  }

  const canViewHidden = await canViewHiddenListing(
    supabase,
    listing as Parameters<typeof canViewHiddenListing>[1],
    user,
  )
  if (!canViewHidden) {
    rejectMerchantCrawlerLandingPage(listing as GoogleMerchantListingRow, userAgent)
    const context = await loadUnavailableListingContext(supabase, listingParam)
    const landing = await buildUnavailableListingLanding(supabase, listingParam, context)
    return <UnavailableListingLandingPage landing={landing} />
  }

  rejectMerchantCrawlerLandingPage(listing as GoogleMerchantListingRow, userAgent)

  if (redirectSlug) {
    redirect(`/l/${redirectSlug}`)
  }

  const sectionProps: ListingDetailPageSharedProps = {
    listingParam,
    prefetchedListing: listing.section === "new" ? undefined : listing,
    viewerUser: user,
  }

  return (
    <ListingDetailPublicBody
      listing={listing as PublicListingRow}
      listingParam={listingParam}
      sectionProps={sectionProps}
    />
  )
}
