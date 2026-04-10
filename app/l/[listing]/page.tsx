import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { findListingByParam } from "@/lib/listing-query"
import {
  getCachedPublicListingForMetadata,
  getCachedPublicListingForRoute,
  LISTING_META_SELECT,
  LISTING_ROUTE_SHELL_SELECT,
} from "@/lib/listing-detail-cache"
import { metadataForListingDetail } from "@/lib/listing-metadata"
import { canViewHiddenListing } from "@/lib/listing-site-access"
import { SurfboardListingDetailPage } from "@/components/surfboard-listing-detail-page"
import { ShopListingDetailPage } from "@/components/shop-listing-detail-page"

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
    return { title: "Listing — Reswell" }
  }
  if (listing.hidden_from_site) {
    const supabase = await createClient()
    if (!(await canViewHiddenListing(supabase, listing))) {
      return { title: "Listing — Reswell", robots: { index: false, follow: false } }
    }
  }
  if (listing.section === "new") {
    const price = Number(listing.price)
    const pricePrefix = Number.isFinite(price) ? `$${price.toFixed(2)}` : undefined
    return metadataForListingDetail({ ...listing, section: "new" as const }, { pricePrefix })
  }
  return metadataForListingDetail(listing)
}

export default async function ListingDetailPage(props: {
  params: Promise<{ listing: string }>
}) {
  const { listing: listingParam } = await props.params
  let { listing, redirectSlug } = await getCachedPublicListingForRoute(listingParam)
  if (!listing) {
    const supabase = await createClient()
    const live = await findListingByParam(supabase, listingParam, {
      select: LISTING_ROUTE_SHELL_SELECT,
      section: undefined,
      includeHiddenListings: true,
    })
    listing = live.listing
    redirectSlug = live.redirectSlug
  }

  if (!listing) {
    notFound()
  }

  const supabase = await createClient()
  if (!(await canViewHiddenListing(supabase, listing))) {
    notFound()
  }

  if (redirectSlug) {
    redirect(`/l/${redirectSlug}`)
  }

  switch (listing.section) {
    case "surfboards":
      return <SurfboardListingDetailPage listingParam={listingParam} />
    case "new":
      return <ShopListingDetailPage listingParam={listingParam} />
    default:
      notFound()
  }
}
