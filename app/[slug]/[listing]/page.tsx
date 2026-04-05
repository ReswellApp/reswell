import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { findListingByParam } from "@/lib/listing-query"
import { capitalizeWords, formatCategory } from "@/lib/listing-labels"
import { UsedListingDetailPage } from "@/components/used-listing-detail-page"

function getPrimaryImageUrl(
  images: Array<{ url?: string | null; is_primary?: boolean; sort_order?: number }> | null | undefined,
): string | undefined {
  if (!images?.length) return undefined
  const sorted = images.slice().sort(
    (a, b) =>
      (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )
  const url = sorted[0]?.url?.trim()
  return url || undefined
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string; listing: string }>
}): Promise<Metadata> {
  const { listing: listingParam } = await props.params
  const supabase = await createClient()
  const { listing } = await findListingByParam(supabase, listingParam, {
    select:
      "id, slug, title, description, status, listing_images (url, is_primary, sort_order), categories (name), section",
    section: "used",
  })

  if (!listing) {
    return { title: "Listing" }
  }

  const sold = listing.status === "sold"
  const title = `${capitalizeWords(listing.title || "Listing")}${sold ? " · Sold" : ""}`
  const category = listing.categories?.name ? `${formatCategory(listing.categories.name)} — ` : ""
  const description = (
    listing.description ||
    `${category}${title} on Reswell.`
  ).slice(0, 180)
  const imageUrl = getPrimaryImageUrl(listing.listing_images)

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  }
}

export default async function UsedListingUnderCategoryPage(props: {
  params: Promise<{ slug: string; listing: string }>
}) {
  const { listing } = await props.params
  return <UsedListingDetailPage listing={listing} />
}
