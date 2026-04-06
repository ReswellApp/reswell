import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { findListingByParam } from "@/lib/listing-query"
import { metadataForListingDetail } from "@/lib/listing-metadata"
import { SurfboardListingDetailPage } from "@/components/surfboard-listing-detail-page"
import { UsedListingDetailPage } from "@/components/used-listing-detail-page"
import { ShopListingDetailPage } from "@/components/shop-listing-detail-page"

const META_SELECT =
  "id, slug, title, description, status, price, listing_images (url, is_primary, sort_order), categories (name, slug), section"

export async function generateMetadata(props: {
  params: Promise<{ listing: string }>
}): Promise<Metadata> {
  const { listing: listingParam } = await props.params
  const supabase = await createClient()
  const { listing } = await findListingByParam(supabase, listingParam, {
    select: META_SELECT,
    section: undefined,
  })
  if (!listing) {
    return { title: "Listing — Reswell" }
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
  const supabase = await createClient()
  const { listing, redirectSlug } = await findListingByParam(supabase, listingParam, {
    select: "id, section, slug",
    section: undefined,
  })

  if (!listing) {
    notFound()
  }

  if (redirectSlug) {
    redirect(`/l/${redirectSlug}`)
  }

  switch (listing.section) {
    case "surfboards":
      return <SurfboardListingDetailPage listingParam={listingParam} />
    case "used":
      return <UsedListingDetailPage listing={listingParam} />
    case "new":
      return <ShopListingDetailPage listingParam={listingParam} />
    default:
      notFound()
  }
}
