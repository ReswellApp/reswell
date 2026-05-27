import type { SupabaseClient } from "@supabase/supabase-js"

export type BrandModelListingImageSourceRow = {
  image_url: string
  thumbnail_url: string | null
  listing_id: string
  listing_title: string
  dimensions: string | null
}

const LISTING_SELECT = `
  id,
  title,
  dimensions,
  listing_images ( url, thumbnail_url, is_primary, sort_order )
`

type ListingRow = {
  id: string
  title: string
  dimensions: string | null
  listing_images:
    | {
        url: string
        thumbnail_url: string | null
        is_primary: boolean | null
        sort_order: number | null
      }[]
    | null
}

function sortListingImages(
  images: NonNullable<ListingRow["listing_images"]>,
): NonNullable<ListingRow["listing_images"]> {
  return [...images].sort((a, b) => {
    const ap = a.is_primary ? 1 : 0
    const bp = b.is_primary ? 1 : 0
    if (ap !== bp) return bp - ap
    const ao = a.sort_order ?? 999
    const bo = b.sort_order ?? 999
    return ao - bo
  })
}

function rowsFromListing(listing: ListingRow): BrandModelListingImageSourceRow[] {
  const images = listing.listing_images ?? []
  if (!images.length) return []

  const title = listing.title.trim() || "Listing"
  const out: BrandModelListingImageSourceRow[] = []

  for (const img of sortListingImages(images)) {
    const url = img.url?.trim()
    if (!url) continue
    out.push({
      image_url: url,
      thumbnail_url: img.thumbnail_url?.trim() || null,
      listing_id: listing.id,
      listing_title: title,
      dimensions: listing.dimensions?.trim() || null,
    })
  }

  return out
}

/** Seller photos on live listings linked to a catalog model (`listings.brand_model_id`). */
export async function listLiveListingImagesForBrandModelAdmin(
  supabase: SupabaseClient,
  brandModelId: string,
  options: { limit?: number } = {},
): Promise<BrandModelListingImageSourceRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 40, 1), 80)

  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("brand_model_id", brandModelId)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("listLiveListingImagesForBrandModelAdmin:", error.message)
    return []
  }

  const out: BrandModelListingImageSourceRow[] = []
  for (const row of (data ?? []) as ListingRow[]) {
    out.push(...rowsFromListing(row))
  }
  return out
}

/** Seller photos on sold listings linked to a catalog model (`listings.brand_model_id`). */
export async function listSoldListingImagesForBrandModelAdmin(
  supabase: SupabaseClient,
  brandModelId: string,
  options: { limit?: number } = {},
): Promise<BrandModelListingImageSourceRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 40, 1), 80)

  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("brand_model_id", brandModelId)
    .eq("status", "sold")
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("listSoldListingImagesForBrandModelAdmin:", error.message)
    return []
  }

  const out: BrandModelListingImageSourceRow[] = []
  for (const row of (data ?? []) as ListingRow[]) {
    out.push(...rowsFromListing(row))
  }
  return out
}
