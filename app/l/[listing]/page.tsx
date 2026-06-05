import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { pageSeoMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"
import { findListingByParam } from "@/lib/listing-query"
import {
  getCachedPublicListingForMetadata,
  getCachedPublicListingForRoute,
  LISTING_META_SELECT,
  LISTING_ROUTE_SHELL_SELECT,
} from "@/lib/listing-detail-cache"
import { resolveListingDetailMetadata } from "@/lib/seo/resolve-listing-metadata"
import { canViewHiddenListing } from "@/lib/listing-site-access"
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
    const supabase = await createClient()
    const live = await findListingByParam(supabase, listingParam, {
      select: LISTING_META_SELECT,
      section: undefined,
      includeHiddenListings: true,
    })
    listing = live.listing
  }
  if (!listing) {
    return unavailableListingMetadata(listingParam)
  }
  if (listing.hidden_from_site) {
    const supabase = await createClient()
    if (!(await canViewHiddenListing(supabase, listing))) {
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
  let { listing, redirectSlug } = await getCachedPublicListingForRoute(listingParam)
  const supabase = await createClient()

  if (!listing) {
    const live = await findListingByParam(supabase, listingParam, {
      select: LISTING_ROUTE_SHELL_SELECT,
      section: undefined,
      includeHiddenListings: true,
    })
    listing = live.listing
    redirectSlug = live.redirectSlug
  }

  if (!listing) {
    const landing = await buildUnavailableListingLanding(supabase, listingParam)
    return <UnavailableListingLandingPage landing={landing} />
  }

  const canViewHidden = await canViewHiddenListing(supabase, listing)
  if (!canViewHidden) {
    const context = await loadUnavailableListingContext(supabase, listingParam)
    const landing = await buildUnavailableListingLanding(supabase, listingParam, context)
    return <UnavailableListingLandingPage landing={landing} />
  }

  if (redirectSlug) {
    redirect(`/l/${redirectSlug}`)
  }

  return (
    <>
      <ListingViewTracker listingId={listing.id} />
      {(() => {
        switch (listing.section) {
          case "surfboards":
            return <SurfboardListingDetailPage listingParam={listingParam} />
          case "fins":
            return <FinsListingDetailPage listingParam={listingParam} />
          case "wetsuits":
            return <WetsuitsListingDetailPage listingParam={listingParam} />
          case "boardbags":
            return <BoardbagsListingDetailPage listingParam={listingParam} />
          case "surfpacks":
            return <SurfpacksListingDetailPage listingParam={listingParam} />
          case "leashes":
            return <LeashesListingDetailPage listingParam={listingParam} />
          case "apparel":
            return <ApparelListingDetailPage listingParam={listingParam} />
          case "accessories":
            return <AccessoriesListingDetailPage listingParam={listingParam} />
          case "new":
            return <ShopListingDetailPage listingParam={listingParam} />
          default:
            notFound()
        }
      })()}
    </>
  )
}
