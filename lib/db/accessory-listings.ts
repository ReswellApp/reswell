/**
 * Data access for accessory listings. Accessories are `listings` rows
 * (section = 'accessories') with the accessory attributes stored directly on the row:
 * `accessory_size` (size), plus `brand`/`brand_id`/`model`.
 *
 * Mirrors the fin browse data layer (`lib/db/fin-listings.ts`) scoped to accessories.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { ACCESSORIES_SECTION } from "@/lib/accessory-listing-config"
import type { AccessoriesBrowseFacetSelections } from "@/lib/accessories-browse-facets"
import { normalizedAccessoriesBrowseSort } from "@/lib/accessories-browse-metadata"
import { listingDetailHref } from "@/lib/listing-href"

export const ACCESSORIES_BROWSE_PAGE_SIZE = 40

export type AccessoryListingImage = {
  id: string
  url: string
  thumbnail_url: string | null
  is_primary: boolean | null
  sort_order: number | null
}

export type AccessoryBrowseListingRow = {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: number
  status: string
  condition: string | null
  local_pickup: boolean | null
  shipping_available: boolean | null
  created_at: string
  accessory_size: string | null
  brand: string | null
  brand_id: string | null
  model: string | null
  listing_images: AccessoryListingImage[] | null
}

const ACCESSORY_BROWSE_LISTING_SELECT = `
  id,
  slug,
  user_id,
  title,
  price,
  status,
  condition,
  local_pickup,
  shipping_available,
  created_at,
  accessory_size,
  brand,
  brand_id,
  model,
  listing_images ( id, url, thumbnail_url, is_primary, sort_order )
`

export type AccessoriesBrowseQueryInput = {
  facets: AccessoriesBrowseFacetSelections
  query?: string
  brand?: string
  minPrice?: number
  maxPrice?: number
  sort?: string
  page: number
  limit?: number
}

/** Paginated active accessory listings for the /accessories browse grid. */
export async function fetchAccessoriesBrowsePage(
  supabase: SupabaseClient,
  input: AccessoriesBrowseQueryInput,
): Promise<{ accessories: AccessoryBrowseListingRow[]; totalPages: number }> {
  const limit = input.limit ?? ACCESSORIES_BROWSE_PAGE_SIZE
  const page = Math.max(1, input.page)
  const offset = (page - 1) * limit

  let q = supabase
    .from("listings")
    .select(ACCESSORY_BROWSE_LISTING_SELECT, { count: "exact" })
    .eq("section", ACCESSORIES_SECTION)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)

  if (input.facets.conditions.length > 0) {
    q = q.in("condition", input.facets.conditions)
  }
  if (input.facets.sizes.length > 0) {
    q = q.in("accessory_size", input.facets.sizes)
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

  const sort = normalizedAccessoriesBrowseSort(input.sort)
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
    console.error("fetchAccessoriesBrowsePage:", error.message)
    return { accessories: [], totalPages: 0 }
  }

  return {
    accessories: (data ?? []) as unknown as AccessoryBrowseListingRow[],
    totalPages: Math.ceil((count ?? 0) / limit),
  }
}

/** Active accessory listing detail URLs (`/l/{slug-or-id}`) for the sitemap. */
export async function fetchAccessoryListingSitemapEntries(
  supabase: SupabaseClient,
): Promise<{ path: string; updatedAt: string | null }[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, slug, updated_at")
    .eq("section", ACCESSORIES_SECTION)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(48000)

  if (error) {
    console.error("fetchAccessoryListingSitemapEntries:", error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    path: listingDetailHref({ id: row.id as string, slug: (row as { slug?: string | null }).slug }),
    updatedAt: (row as { updated_at?: string | null }).updated_at ?? null,
  }))
}
