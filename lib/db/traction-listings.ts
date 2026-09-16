/**
 * Data access for traction listings. Traction are `listings` rows
 * (section = 'traction') with the traction attributes stored directly on the row:
 * `traction_size` (size), plus `brand`/`brand_id`/`model`.
 *
 * Mirrors the fin browse data layer (`lib/db/fin-listings.ts`) scoped to traction.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { TRACTION_SECTION } from "@/lib/traction-listing-config"
import type { TractionBrowseFacetSelections } from "@/lib/traction-browse-facets"
import { normalizedTractionBrowseSort } from "@/lib/traction-browse-metadata"
import { listingDetailHref } from "@/lib/listing-href"
import { hydrateCardListingImages } from "@/lib/listing-image-display"

export const TRACTION_BROWSE_PAGE_SIZE = 40

export type TractionListingImage = {
  id: string
  url: string
  thumbnail_url: string | null
  is_primary: boolean | null
  sort_order: number | null
}

export type TractionBrowseListingRow = {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: number
  compare_at_price: number | null
  status: string
  condition: string | null
  local_pickup: boolean | null
  shipping_available: boolean | null
  created_at: string
  traction_size: string | null
  brand: string | null
  brand_id: string | null
  model: string | null
  listing_images: TractionListingImage[] | null
}

const TRACTION_BROWSE_LISTING_SELECT = `
  id,
  slug,
  user_id,
  title,
  price,
  compare_at_price,
  status,
  condition,
  local_pickup,
  shipping_available,
  created_at,
  traction_size,
  brand,
  brand_id,
  model,
  primary_image_url,
  primary_thumbnail_url,
  tile_gallery_images
`

export type TractionBrowseQueryInput = {
  facets: TractionBrowseFacetSelections
  query?: string
  brand?: string
  minPrice?: number
  maxPrice?: number
  sort?: string
  page: number
  limit?: number
}

/** Paginated active traction listings for the /traction browse grid. */
export async function fetchTractionBrowsePage(
  supabase: SupabaseClient,
  input: TractionBrowseQueryInput,
): Promise<{ traction: TractionBrowseListingRow[]; totalPages: number }> {
  const limit = input.limit ?? TRACTION_BROWSE_PAGE_SIZE
  const page = Math.max(1, input.page)
  const offset = (page - 1) * limit

  let q = supabase
    .from("listings")
    .select(TRACTION_BROWSE_LISTING_SELECT, { count: "exact" })
    .eq("section", TRACTION_SECTION)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)

  if (input.facets.conditions.length > 0) {
    q = q.in("condition", input.facets.conditions)
  }
  if (input.facets.sizes.length > 0) {
    q = q.in("traction_size", input.facets.sizes)
  }

  const brand = input.brand?.trim()
  if (brand) {
    q = q.ilike("brand", `%${brand}%`)
  }

  const query = input.query?.trim()
  if (query) {
    q = q.ilike("title", `%${query}%`)
  }

  if (input.minPrice != null && Number.isFinite(input.minPrice)) {
    q = q.gte("price", input.minPrice)
  }
  if (input.maxPrice != null && Number.isFinite(input.maxPrice)) {
    q = q.lte("price", input.maxPrice)
  }

  const sort = normalizedTractionBrowseSort(input.sort)
  if (sort === "price-low") {
    q = q.order("price", { ascending: true })
  } else if (sort === "price-high") {
    q = q.order("price", { ascending: false })
  } else {
    q = q.order("created_at", { ascending: false })
  }

  q = q.range(offset, offset + limit - 1)

  const { data, count, error } = await q
  if (error) {
    console.error("fetchTractionBrowsePage:", error.message)
    return { traction: [], totalPages: 0 }
  }

  return {
    traction: hydrateCardListingImages((data ?? []) as unknown as TractionBrowseListingRow[]),
    totalPages: Math.ceil((count ?? 0) / limit),
  }
}

/** Active traction listing detail URLs (`/l/{slug-or-id}`) for the sitemap. */
export async function fetchTractionListingSitemapEntries(
  supabase: SupabaseClient,
): Promise<{ path: string; updatedAt: string | null }[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, slug, updated_at")
    .eq("section", TRACTION_SECTION)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(48000)

  if (error) {
    console.error("fetchTractionListingSitemapEntries:", error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    path: listingDetailHref({ id: row.id as string, slug: (row as { slug?: string | null }).slug }),
    updatedAt: (row as { updated_at?: string | null }).updated_at ?? null,
  }))
}
