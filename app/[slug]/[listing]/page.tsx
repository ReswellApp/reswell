import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { findListingByParam } from "@/lib/listing-query"
import { metadataForListingDetail } from "@/lib/listing-metadata"
import { UsedListingDetailPage } from "@/components/used-listing-detail-page"

export async function generateMetadata(props: {
  params: Promise<{ slug: string; listing: string }>
}): Promise<Metadata> {
  const { listing: listingParam } = await props.params
  const supabase = await createClient()
  const { listing } = await findListingByParam(supabase, listingParam, {
    select:
      "id, slug, title, description, status, listing_images (url, is_primary, sort_order), categories (name, slug), section",
    section: "used",
  })

  if (!listing) {
    return { title: "Listing" }
  }

  return metadataForListingDetail(listing)
}

export default async function UsedListingUnderCategoryPage(props: {
  params: Promise<{ slug: string; listing: string }>
}) {
  const { listing } = await props.params
  return <UsedListingDetailPage listing={listing} />
}
