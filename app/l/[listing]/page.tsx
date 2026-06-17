import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
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
import { createClient } from "@/lib/supabase/server"
import { isGoogleMerchantLandingPageCrawler } from "@/lib/google-merchant/landing-page-crawler"
import {
  isGoogleMerchantEligibleListing,
  type GoogleMerchantListingRow,
} from "@/lib/google-merchant/map-listing-to-product-input"
import { SurfboardListingDetailPage } from "@/components/surfboard-listing-detail-page"
import { FinsListingDetailPage } from "@/components/fins-listing-detail-page"
import { WetsuitsListingDetailPage } from "@/components/wetsuits-listing-detail-page"
import { BoardbagsListingDetailPage } from "@/components/boardbags-listing-detail-page"
import { SurfpacksListingDetailPage } from "@/components/surfpacks-listing-detail-page"
import { LeashesListingDetailPage } from "@/components/leashes-listing-detail-page"
import { ApparelListingDetailPage } from "@/components/apparel-listing-detail-page"
import { AccessoriesListingDetailPage } from "@/components/accessories-listing-detail-page"
import { ShopListingDetailPage } from "@/components/shop-listing-detail-page"
import { ListingViewTracker } from "@/components/features/listings/listing-view-tracker"
import { UnavailableListingLandingPage } from "@/components/features/listings/unavailable-listing-landing-page"
import { buildUnavailableListingLanding } from "@/lib/services/unavailableListingLanding"
import {
  UNAVAILABLE_LISTING_CONTEXT_SELECT,
  type UnavailableListingContextRow,
} from "@/lib/db/unavailable-listing-landing"
import type { ListingDetailPageSharedProps } from "@/lib/listing-detail-page-load"

/** Merchant Center expects a 404 when the feed product is gone — not a soft "unavailable" page. */
function rejectMerchantCrawlerLandingPage(
  listing: GoogleMerchantListingRow | null,
  userAgent: string | null,
): void {
  if (!isGoogleMerchantLandingPageCrawler(userAgent)) return
  if (!listing || !isGoogleMerchantEligibleListing(listing)) {
    notFound()
  }
}

function unavailableListingMetadata(listingParam: string): Metadata {
  return pageSeoMetadata({
    title: "This board is no longer available — Reswell",
    description: "Check out related surfboards on Reswell.",
    path: `/l/${listingParam}`,
  })
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
  const userAgent = (await headers()).get("user-agent")
  const { supabase, user } = await getCachedRequestSession()
  let { listing, redirectSlug } = await getCachedPublicListingForRoute(listingParam)

  if (!listing) {
    const live = await findListingByParam(supabase, listingParam, {
      select: SURFBOARD_LISTING_SELECT,
      section: undefined,
      includeHiddenListings: true,
    })
    listing = live.listing
    redirectSlug = live.redirectSlug
  }

  if (!listing) {
    rejectMerchantCrawlerLandingPage(null, userAgent)
    const landing = await buildUnavailableListingLanding(supabase, listingParam)
    return <UnavailableListingLandingPage landing={landing} />
  }

  const canViewHidden = await canViewHiddenListing(supabase, listing, user)
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
    <>
      <ListingViewTracker listingId={listing.id} />
      {(() => {
        switch (listing.section) {
          case "surfboards":
            return <SurfboardListingDetailPage {...sectionProps} />
          case "fins":
            return <FinsListingDetailPage {...sectionProps} />
          case "wetsuits":
            return <WetsuitsListingDetailPage {...sectionProps} />
          case "boardbags":
            return <BoardbagsListingDetailPage {...sectionProps} />
          case "surfpacks":
            return <SurfpacksListingDetailPage {...sectionProps} />
          case "leashes":
            return <LeashesListingDetailPage {...sectionProps} />
          case "apparel":
            return <ApparelListingDetailPage {...sectionProps} />
          case "accessories":
            return <AccessoriesListingDetailPage {...sectionProps} />
          case "new":
            return <ShopListingDetailPage listingParam={listingParam} />
          default:
            notFound()
        }
      })()}
    </>
  )
}
