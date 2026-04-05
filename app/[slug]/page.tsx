import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { findListingByParam } from "@/lib/listing-query"
import { capitalizeWords, formatCategory } from "@/lib/listing-labels"
import type { UsedGearSearchParams } from "@/components/used-gear-listings"
import { UsedAllGearPage } from "@/components/used-all-gear-page"
import { BoardsBrowsePage } from "@/components/boards-browse-page"
import { UsedCategoryBrowsePage } from "@/components/used-category-browse-page"
import { UsedListingDetailPage } from "@/components/used-listing-detail-page"
import {
  metadataForAllGear,
  metadataForBoardsBrowse,
  metadataForUsedCategoryBrowse,
  type BoardsBrowseSearchParams,
} from "@/lib/marketplace-slug-metadata"

function flattenSearchParams(
  sp: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  const o: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp)) {
    o[k] = Array.isArray(v) ? v[0] : v
  }
  return o
}

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
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const { slug } = await props.params
  const rawSp = await props.searchParams
  const flat = flattenSearchParams(rawSp)
  const usedSp = flat as UsedGearSearchParams

  if (slug === "gear") {
    return metadataForAllGear(usedSp)
  }
  if (slug === "boards") {
    return metadataForBoardsBrowse(flat as BoardsBrowseSearchParams)
  }

  const supabase = await createClient()
  const { data: usedCat } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("gear", true)
    .eq("slug", slug)
    .maybeSingle()

  if (usedCat) {
    return metadataForUsedCategoryBrowse(usedCat.slug, usedCat.name, usedSp)
  }

  const { listing } = await findListingByParam(supabase, slug, {
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

export default async function MarketplaceSlugPage(props: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await props.params
  const searchParamsPromise = props.searchParams.then(
    (sp) => flattenSearchParams(sp) as UsedGearSearchParams,
  )

  if (slug === "gear") {
    return <UsedAllGearPage searchParams={searchParamsPromise} />
  }
  if (slug === "boards") {
    return (
      <BoardsBrowsePage
        searchParams={props.searchParams.then((sp) => flattenSearchParams(sp) as BoardsBrowseSearchParams)}
      />
    )
  }

  const supabase = await createClient()
  const { data: usedCat } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("gear", true)
    .eq("slug", slug)
    .maybeSingle()

  if (usedCat) {
    return <UsedCategoryBrowsePage category={usedCat} searchParams={searchParamsPromise} />
  }

  return <UsedListingDetailPage listing={slug} />
}
